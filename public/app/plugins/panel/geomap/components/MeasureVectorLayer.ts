import { FeatureLike } from 'ol/Feature';
import Map from 'ol/Map';
import { Coordinate } from 'ol/coordinate';
import { Geometry, LineString, Point, Polygon } from 'ol/geom';
import { Type } from 'ol/geom/Geometry';
import { Draw, Modify } from 'ol/interaction';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { getArea, getLength } from 'ol/sphere';
import { Circle as CircleStyle, Fill, RegularShape, Stroke, Style, Text } from 'ol/style';

import { formattedValueToString } from '@grafana/data';

import { MapMeasureOptions, measures } from '../utils/measure';

export class MeasureVectorLayer extends VectorLayer<VectorSource> {
  opts: MapMeasureOptions = {
    action: 'length',
    unit: 'm',
  };
  constructor() {
    super({
      source: new VectorSource(),
    });
    this.setStyle((feature) => {
      return this.styleFunction(feature, false);
    });
    this.setVisible(true);
  }

  setOptions(options: MapMeasureOptions) {
    this.opts = options;
    this.getSource()?.refresh();
  }

  getMapMeasurement(geo: Geometry): string {
    let v = 0;
    let action = measures[0];
    if (this.opts.action === 'area') {
      action = measures[1];
      v = getArea(geo);
    } else {
      v = getLength(geo);
    }
    return formattedValueToString(action.getUnit(this.opts.unit).format(v));
  }

  segmentStyle = new Style({
    text: new Text({
      font: '12px Calibri,sans-serif',
      fill: new Fill({
        color: 'rgba(255, 255, 255, 1)',
      }),
      backgroundFill: new Fill({
        color: 'rgba(0, 0, 0, 0.4)',
      }),
      padding: [2, 2, 2, 2],
      textBaseline: 'bottom',
      offsetY: -12,
    }),
    image: new RegularShape({
      radius: 6,
      points: 3,
      angle: Math.PI,
      displacement: [0, 8],
      fill: new Fill({
        color: 'rgba(0, 0, 0, 0.4)',
      }),
    }),
  });

  segmentStyles = [this.segmentStyle];

  // Open Layer styles
  shapeStyle = [
    new Style({
      fill: new Fill({
        color: 'rgba(255, 255, 255, 0.2)',
      }),
      image: new CircleStyle({
        radius: 5,
        stroke: new Stroke({
          color: 'rgba(0, 0, 0, 0.7)',
        }),
        fill: new Fill({
          color: 'rgba(255, 255, 255, 0.2)',
        }),
      }),
    }),
    new Style({
      stroke: new Stroke({
        color: [0, 0, 0, 1],
        width: 2,
        lineDash: [4, 8],
        lineDashOffset: 6,
      }),
    }),
    new Style({
      stroke: new Stroke({
        color: [255, 255, 255, 1],
        width: 2,
        lineDash: [4, 8],
      }),
    }),
  ];

  labelStyle = new Style({
    text: new Text({
      font: '14px Calibri,sans-serif',
      fill: new Fill({
        color: 'rgba(255, 255, 255, 1)',
      }),
      backgroundFill: new Fill({
        color: 'rgba(0, 0, 0, 0.7)',
      }),
      padding: [3, 3, 3, 3],
      textBaseline: 'bottom',
      offsetY: -15,
    }),
    image: new RegularShape({
      radius: 8,
      points: 3,
      angle: Math.PI,
      displacement: [0, 10],
      fill: new Fill({
        color: 'rgba(0, 0, 0, 0.7)',
      }),
    }),
  });

  tipStyle = new Style({
    text: new Text({
      font: '12px Calibri,sans-serif',
      fill: new Fill({
        color: 'rgba(255, 255, 255, 1)',
      }),
      backgroundFill: new Fill({
        color: 'rgba(0, 0, 0, 0.4)',
      }),
      padding: [2, 2, 2, 2],
      textAlign: 'left',
      offsetX: 15,
    }),
  });

  modifyStyle = new Style({
    image: new CircleStyle({
      radius: 5,
      stroke: new Stroke({
        color: 'rgba(0, 0, 0, 0.7)',
      }),
      fill: new Fill({
        color: 'rgba(0, 0, 0, 0.4)',
      }),
    }),
    text: new Text({
      text: 'Drag to modify',
      font: '12px Calibri,sans-serif',
      fill: new Fill({
        color: 'rgba(255, 255, 255, 1)',
      }),
      backgroundFill: new Fill({
        color: 'rgba(0, 0, 0, 0.7)',
      }),
      padding: [2, 2, 2, 2],
      textAlign: 'left',
      offsetX: 15,
    }),
  });

  readonly modify = new Modify({ source: this.getSource()!, style: this.modifyStyle });
  tipPoint!: Geometry;
  draw!: Draw; // global so we can remove it later

  styleFunction(feature: FeatureLike, segments: boolean, drawType?: string, tip?: string): Style[] {
    const styles = [...this.shapeStyle];
    const geometry = feature.getGeometry() as Geometry;
    if (geometry) {
      const type = geometry.getType();
      let point: Point;
      let label: string;
      let line: LineString;
      if (!drawType || drawType === type) {
        if (type === 'Polygon') {
          const poly = geometry as Polygon;
          point = poly.getInteriorPoint();
          label = this.getMapMeasurement(geometry);
          line = new LineString(poly.getCoordinates()[0]);
        } else if (type === 'LineString') {
          line = geometry as LineString;
          point = new Point(line.getLastCoordinate());
          label = this.getMapMeasurement(geometry);
        }
      }
      if (segments && line!) {
        let count = 0;
        line.forEachSegment((a: Coordinate, b: Coordinate) => {
          const segment = new LineString([a, b]);
          const label = this.getMapMeasurement(segment);
          if (this.segmentStyles.length - 1 < count) {
            this.segmentStyles.push(this.segmentStyle.clone());
          }
          const segmentPoint = new Point(segment.getCoordinateAt(0.5));
          this.segmentStyles[count].setGeometry(segmentPoint);
          this.segmentStyles[count].getText().setText(label);
          styles.push(this.segmentStyles[count]);
          count++;
        });
      }
      if (label!) {
        this.labelStyle.setGeometry(point!);
        this.labelStyle.getText().setText(label);
        styles.push(this.labelStyle);
      }
      if (tip && type === 'Point' && !this.modify.getOverlay().getSource().getFeatures().length) {
        this.tipPoint = geometry;
        this.tipStyle.getText().setText(tip);
        styles.push(this.tipStyle);
      }
    }
    return styles;
  }

  addInteraction(map: Map, typeSelect: Type, showSegments: boolean, clearPrevious: boolean) {
    const drawType = typeSelect;
    const activeTip =
      ' Click to continue ' + (drawType === 'Polygon' ? 'polygon' : 'line') + ' \n (double-click to end) ';
    const idleTip = ' Click to start ';
    let tip = idleTip;
    this.draw = new Draw({
      source: this.getSource()!,
      type: drawType,
      style: (feature) => {
        return this.styleFunction(feature, showSegments, drawType, tip);
      },
    });
    this.draw.on('drawstart', () => {
      if (clearPrevious) {
        this.getSource()!.clear();
      }
      this.modify.setActive(false);
      tip = activeTip;
    });
    this.draw.on('drawend', () => {
      this.modifyStyle.setGeometry(this.tipPoint);
      this.modify.setActive(true);
      map.once('pointermove', () => {
        this.modifyStyle.setGeometry('');
      });
      tip = idleTip;
    });
    this.modify.setActive(true);
    map.addInteraction(this.draw);
  }
}
