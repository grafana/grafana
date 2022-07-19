import { css } from '@emotion/css';
import Map from 'ol/Map';
import { Geometry, LineString, Point } from 'ol/geom';
import { Draw, Modify } from 'ol/interaction';
import { Vector as VectorLayer } from 'ol/layer';
import { Vector as VectorSource } from 'ol/source';
import { getArea, getLength } from 'ol/sphere';
import { Circle as CircleStyle, Fill, RegularShape, Stroke, Style, Text } from 'ol/style';
import React, { useState } from 'react';
import tinycolor from 'tinycolor2';

import { GrafanaTheme } from '@grafana/data';
import { IconButton, RadioButtonGroup, stylesFactory } from '@grafana/ui';
import { config } from 'app/core/config';

type Props = {
  map: Map;
  menuActiveState: (value: boolean) => void;
};

// Open Layer styles
const style = new Style({
  fill: new Fill({
    color: 'rgba(255, 255, 255, 0.2)',
  }),
  stroke: new Stroke({
    color: 'rgba(0, 0, 0, 0.5)',
    lineDash: [10, 10],
    width: 2,
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
});

const labelStyle = new Style({
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

const tipStyle = new Style({
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

const modifyStyle = new Style({
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

const segmentStyle = new Style({
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

const segmentStyles = [segmentStyle];
const source = new VectorSource();
const vector = new VectorLayer({
  source: source,
  style: function (feature) {
    return styleFunction(feature, false);
  },
  visible: true,
});

const modify = new Modify({ source: source, style: modifyStyle });
let tipPoint: Geometry;
let draw: Draw; // global so we can remove it later

const formatLength = function (line: Geometry) {
  const length = getLength(line);
  let output;
  if (length > 100) {
    output = Math.round((length / 1000) * 100) / 100 + ' km';
  } else {
    output = Math.round(length * 100) / 100 + ' m';
  }
  return output;
};

const formatArea = function (polygon: Geometry) {
  const area = getArea(polygon);
  let output;
  if (area > 10000) {
    output = Math.round((area / 1000000) * 100) / 100 + ' km\xB2';
  } else {
    output = Math.round(area * 100) / 100 + ' m\xB2';
  }
  return output;
};

// TODO: reconcile Feature type in open layers
// eslint-disable-next-line
function styleFunction(feature: any, segments: boolean, drawType?: string, tip?: string) {
  const styles = [style];
  const geometry = feature.getGeometry();
  if (geometry) {
    const type = geometry.getType();
    let point, label, line;
    if (!drawType || drawType === type) {
      if (type === 'Polygon') {
        point = geometry.getInteriorPoint();
        label = formatArea(geometry);
        line = new LineString(geometry.getCoordinates()[0]);
      } else if (type === 'LineString') {
        point = new Point(geometry.getLastCoordinate());
        label = formatLength(geometry);
        line = geometry;
      }
    }
    if (segments && line) {
      let count = 0;
      line.forEachSegment(function (a: number, b: number) {
        const segment = new LineString([a, b]);
        const label = formatLength(segment);
        if (segmentStyles.length - 1 < count) {
          segmentStyles.push(segmentStyle.clone());
        }
        const segmentPoint = new Point(segment.getCoordinateAt(0.5));
        segmentStyles[count].setGeometry(segmentPoint);
        segmentStyles[count].getText().setText(label);
        styles.push(segmentStyles[count]);
        count++;
      });
    }
    if (label) {
      labelStyle.setGeometry(point);
      labelStyle.getText().setText(label);
      styles.push(labelStyle);
    }
    if (tip && type === 'Point' && !modify.getOverlay().getSource().getFeatures().length) {
      tipPoint = geometry;
      tipStyle.getText().setText(tip);
      styles.push(tipStyle);
    }
  }

  return styles;
}

function addInteraction(map: Map, typeSelect: string, showSegments: boolean, clearPrevious: boolean) {
  const drawType = typeSelect;
  const activeTip =
    ' Click to continue ' + (drawType === 'Polygon' ? 'polygon' : 'line') + ' \n (double-click to end) ';
  const idleTip = ' Click to start ';
  let tip = idleTip;
  draw = new Draw({
    source: source,
    type: drawType,
    style: function (feature) {
      return styleFunction(feature, showSegments, drawType, tip);
    },
  });
  draw.on('drawstart', function () {
    if (clearPrevious) {
      source.clear();
    }
    modify.setActive(false);
    tip = activeTip;
  });
  draw.on('drawend', function () {
    modifyStyle.setGeometry(tipPoint);
    modify.setActive(true);
    map.once('pointermove', function () {
      modifyStyle.setGeometry('');
    });
    tip = idleTip;
  });
  modify.setActive(true);
  map.addInteraction(draw);
}

export const MeasureOverlay = ({ map, menuActiveState }: Props) => {
  const measureStyle = getStyles(config.theme);

  // Menu State Management
  const [firstLoad, setFirstLoad] = useState<boolean>(true);
  const [menuActive, setMenuActive] = useState<boolean>(false);

  // Options State
  const [typeSelect, setTypeSelect] = useState<string>('LineString');
  const clearPrevious = true;
  const showSegments = false;

  return (
    <div className={measureStyle.infoWrap} style={{ paddingBottom: '4px' }}>
      {menuActive ? (
        <RadioButtonGroup
          value={typeSelect}
          options={[
            { label: 'Length', value: 'LineString' },
            { label: 'Area', value: 'Polygon' },
          ]}
          size="sm"
          onChange={(e) => {
            map.removeInteraction(draw);
            setTypeSelect(e);
            addInteraction(map, e, showSegments, clearPrevious);
          }}
        />
      ) : null}
      <IconButton
        name="ruler-combined"
        style={{ marginLeft: '5px' }}
        tooltip={`${menuActive ? 'hide' : 'show'} measure tools`}
        tooltipPlacement="right"
        onClick={() => {
          setMenuActive(!menuActive);
          // Lift menu state
          // TODO: consolidate into one state
          menuActiveState(!menuActive);
          if (menuActive) {
            map.removeInteraction(draw);
            vector.set('visible', false);
          } else {
            if (firstLoad) {
              // Initialize on first load
              setFirstLoad(false);
              map.addLayer(vector);
              map.addInteraction(modify);
            }
            vector.set('visible', true);
            map.removeInteraction(draw); // Remove last interaction
            addInteraction(map, typeSelect, showSegments, clearPrevious);
          }
        }}
      />
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  infoWrap: css`
    color: ${theme.colors.text};
    background: ${tinycolor(theme.colors.panelBg).setAlpha(0.7).toString()};
    border-radius: 2px;
    padding: 8px;
  `,
}));
