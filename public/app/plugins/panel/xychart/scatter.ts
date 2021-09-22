import { DataFrame, getFieldDisplayName, getFieldSeriesColor, GrafanaTheme2, PanelData } from '@grafana/data';
import { AxisPlacement, ScaleDirection, ScaleOrientation } from '@grafana/schema';
import { DimensionValues, UPlotConfigBuilder } from '@grafana/ui';
import { FacetedData, FacetSeries } from '@grafana/ui/src/components/uPlot/types';
import {
  ColorDimensionConfig,
  findFieldIndex,
  getColorDimensionForField,
  getScaledDimensionForField,
  getTextDimensionForField,
  ScaleDimensionConfig,
  TextDimensionConfig,
} from 'app/features/dimensions';
import { config } from '@grafana/runtime';
import { defaultScatterConfig, ScatterFieldConfig, XYChartOptions } from './models.gen';
import { pointWithin, Quadtree, Rect } from '../barchart/quadtree';
import { alpha } from '@grafana/data/src/themes/colorManipulator';
import uPlot from 'uplot';
import { ScatterSeries } from './types';

export interface ScatterPanelInfo {
  error?: string;
  series?: ScatterSeries[];
  builder?: UPlotConfigBuilder;

  // Called whenever the data changes
  //  prepare: (data: PanelData) => FacetedData | AlignedData;
}

/**
 * This is called when options or structure rev changes
 */
export function prepScatter(options: XYChartOptions, data: PanelData, theme: GrafanaTheme2): ScatterPanelInfo {
  let series: ScatterSeries[];
  let builder: UPlotConfigBuilder;

  try {
    series = prepSeries(options, data.series);
    builder = prepConfig(data.series, series, theme);
  } catch (e) {
    return {
      error: e.message,
    };
  }

  return {
    series,
    builder,
  };
}

function prepSeries(options: XYChartOptions, frames: DataFrame[]) {
  if (!frames.length) {
    throw 'missing data';
  }

  const series: ScatterSeries[] = [];

  if (options.mode === 'single') {
    const { single } = options;

    if (!single?.x) {
      throw 'Select X dimension';
    }

    if (!single?.y) {
      throw 'Select Y dimension';
    }

    let seriesIndex = 0;

    for (let frameIndex = 0; frameIndex < frames.length; frameIndex++) {
      const frame = frames[frameIndex];
      const xIndex = findFieldIndex(frame, single.x);

      if (xIndex != null) {
        // TODO: this should find multiple y fields
        const yIndex = findFieldIndex(frame, single.y);

        if (yIndex == null) {
          throw 'Y must be in the same frame as X';
        }

        const y = frame.fields[yIndex];
        let state = y.state ?? {};
        state.seriesIndex = seriesIndex++;
        y.state = state;

        // can be used to generate pointColor from thresholds, or text labels with formatting
        // const disp =
        //   y.display ??
        //   getDisplayProcessor({
        //     field: y,
        //     theme: config.theme2,
        //     timeZone: tz,
        //   });

        const fieldConfig: ScatterFieldConfig = { ...defaultScatterConfig, ...y.config.custom };

        const name = getFieldDisplayName(y, frame, frames);

        series.push({
          name,

          frame: (frames) => frames[frameIndex],

          x: (frame) => frame.fields[xIndex],
          y: (frame) => frame.fields[yIndex],
          legend: (frame) => {
            return [
              {
                label: name,
                color: '#f00', // single color for series?
                getItemKey: () => name,
                yAxis: yIndex, // << but not used
              },
            ];
          },

          line: fieldConfig.line!,
          lineWidth: fieldConfig.lineWidth!,
          lineStyle: fieldConfig.lineStyle!,
          lineColor: getColorValues(frame, yIndex, fieldConfig.lineColor),

          point: fieldConfig.point!,
          pointSize: getScaledValues(frame, yIndex, fieldConfig.pointSize),
          pointColor: getColorValues(frame, yIndex, fieldConfig.pointColor),
          pointSymbol: (frame: DataFrame, from?: number) => 'circle', // single field, multiple symbols.... kinda equals multiple series 🤔

          label: fieldConfig.label!,
          labelValue: getTextValues(frame, yIndex, fieldConfig.labelValue),
        });
        break; // only one for now
      }
    }
  }

  return series;
}

//const prepConfig: UPlotConfigPrepFnXY<XYChartOptions> = ({ frames, series, theme }) => {
const prepConfig = (frames: DataFrame[], series: ScatterSeries[], theme: GrafanaTheme2) => {
  let qt: Quadtree;
  let hRect: Rect | null;

  // size range in pixels (diameter)
  let minSize = 6;
  let maxSize = 60;

  let maxArea = maxSize ** 2;
  let minArea = minSize ** 2;

  // quadratic scaling (px area)
  function getSize(value: number, minValue: number, maxValue: number) {
    let pct = value / (maxValue - minValue);
    let area = minArea + pct * (maxArea - minArea);
    return Math.sqrt(area);
  }

  // TODO: maybe passed as pathbuilder option, similar to bars pathbuilder
  /*
  disp: {
    size: {
      unit: 3,
      values: (u, seriesIdx) => u.series[seriesIdx][2].map(v => getSize(v)),
    },
  },
  */

  const drawBubbles: uPlot.Series.PathBuilder = (u, seriesIdx, idx0, idx1) => {
    uPlot.orient(
      u,
      seriesIdx,
      (
        series,
        dataX,
        dataY,
        scaleX,
        scaleY,
        valToPosX,
        valToPosY,
        xOff,
        yOff,
        xDim,
        yDim,
        moveTo,
        lineTo,
        rect,
        arc
      ) => {
        let d = (u.data[seriesIdx] as unknown) as FacetSeries;

        let strokeWidth = 1;

        u.ctx.save();

        u.ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
        u.ctx.clip();

        u.ctx.fillStyle = (series.fill as any)();
        u.ctx.strokeStyle = (series.stroke as any)();
        u.ctx.lineWidth = strokeWidth;

        let deg360 = 2 * Math.PI;

        // todo: this depends on direction & orientation
        // todo: calc once per redraw, not per path
        let filtLft = u.posToVal(-maxSize / 2, 'x');
        let filtRgt = u.posToVal(u.bbox.width / devicePixelRatio + maxSize / 2, 'x');
        let filtBtm = u.posToVal(u.bbox.height / devicePixelRatio + maxSize / 2, 'y');
        let filtTop = u.posToVal(-maxSize / 2, 'y');

        // todo only re-calc during data changes
        let minValue = Infinity;
        let maxValue = -Infinity;

        for (let i = 0; i < d[2].length; i++) {
          let size = d[2][i];

          minValue = Math.min(minValue, size);
          maxValue = Math.max(minValue, size);
        }

        for (let i = 0; i < d[0].length; i++) {
          let xVal = d[0][i];
          let yVal = d[1][i];
          let size = getSize(d[2][i], minValue, maxValue);

          if (xVal >= filtLft && xVal <= filtRgt && yVal >= filtBtm && yVal <= filtTop) {
            let cx = valToPosX(xVal, scaleX, xDim, xOff);
            let cy = valToPosY(yVal, scaleY, yDim, yOff);

            u.ctx.moveTo(cx + size / 2, cy);
            u.ctx.beginPath();
            u.ctx.arc(cx, cy, size / 2, 0, deg360);
            u.ctx.fill();
            u.ctx.stroke();
            qt.add({
              x: cx - size / 2 - strokeWidth / 2 - u.bbox.left,
              y: cy - size / 2 - strokeWidth / 2 - u.bbox.top,
              w: size + strokeWidth,
              h: size + strokeWidth,
              sidx: seriesIdx,
              didx: i,
            });
          }
        }

        u.ctx.restore();
      }
    );

    return null;
  };

  const builder = new UPlotConfigBuilder();

  builder.setCursor({
    dataIdx: (u, seriesIdx) => {
      if (seriesIdx === 1) {
        hRect = null;

        let dist = Infinity;
        let cx = u.cursor.left! * devicePixelRatio;
        let cy = u.cursor.top! * devicePixelRatio;

        qt.get(cx, cy, 1, 1, (o) => {
          if (pointWithin(cx, cy, o.x, o.y, o.x + o.w, o.y + o.h)) {
            let ocx = o.x + o.w / 2;
            let ocy = o.y + o.h / 2;

            let dx = ocx - cx;
            let dy = ocy - cy;

            let d = Math.sqrt(dx ** 2 + dy ** 2);

            // test against radius for actual hover
            if (d <= o.w / 2) {
              // only hover bbox with closest distance
              if (d <= dist) {
                dist = d;
                hRect = o;
              }
            }
          }
        });
      }

      return hRect && seriesIdx === hRect.sidx ? hRect.didx : null;
    },
    points: {
      size: (u, seriesIdx) => {
        return hRect && seriesIdx === hRect.sidx ? hRect.w / devicePixelRatio : 0;
      },
    },
  });

  builder.addHook('drawClear', (u) => {
    qt = qt || new Quadtree(0, 0, u.bbox.width, u.bbox.height);

    qt.clear();

    // force-clear the path cache to cause drawBars() to rebuild new quadtree
    u.series.forEach((s, i) => {
      if (i > 0) {
        // @ts-ignore
        s._paths = null;
      }
    });
  });

  builder.setMode(2);

  builder.addScale({
    scaleKey: 'x',
    isTime: false,
    orientation: ScaleOrientation.Horizontal,
    direction: ScaleDirection.Right,
    range: (u, min, max) => [min, max],
  });

  builder.addScale({
    scaleKey: 'y',
    orientation: ScaleOrientation.Vertical,
    direction: ScaleDirection.Up,
    range: (u, min, max) => [min, max],
  });

  builder.addAxis({
    scaleKey: 'x',
    placement: AxisPlacement.Bottom,
    theme,
  });

  builder.addAxis({
    scaleKey: 'y',
    placement: AxisPlacement.Left,
    theme,
  });

  series.forEach((s) => {
    let frame = s.frame(frames);
    let field = s.y(frame);

    const scaleColor = getFieldSeriesColor(field, theme);
    const seriesColor = scaleColor.color;

    //const lineColor = s.lineColor(frame);
    //const lineWidth = s.lineWidth;

    console.log('addSeries!');

    builder.addSeries({
      pathBuilder: drawBubbles, // drawBubbles({disp: {size: {values: () => }}})
      theme,
      scaleKey: '', // facets' scales used internally (x/y)
      lineColor: seriesColor,
      fillColor: alpha(seriesColor, 0.5),
    });
  });

  /*
  builder.setPrepData((frames) => {
    let seriesData = lookup.fieldMaps.flatMap((f, i) => {
      let { fields } = frames[i];

      return f.y.map((yIndex, frameSeriesIndex) => {
        let xValues = fields[f.x[frameSeriesIndex]].values.toArray();
        let yValues = fields[f.y[frameSeriesIndex]].values.toArray();
        let sizeValues = f.size![frameSeriesIndex](frames[i]);

        if (!Array.isArray(sizeValues)) {
          sizeValues = Array(xValues.length).fill(sizeValues);
        }

        return [xValues, yValues, sizeValues];
      });
    });

    return [null, ...seriesData];
  });
  */

  return builder;
};

/**
 * This is called everytime the data changes
 *
 * from?  is this where we would support that?  -- need the previous values
 */
export function prepData(info: ScatterPanelInfo, data: DataFrame[], from?: number): FacetedData {
  if (info.error) {
    return [null];
  }
  return [
    null,
    ...info.series.map((s, idx) => {
      const frame = s.frame(data);
      // TODO obviously add color etc etc
      return [
        s.x(frame).values.toArray(), // X
        s.y(frame).values.toArray(), // Y
        frame.fields[2].values.toArray(), // this should push raw values from which size is computed
        //s.pointSize(frame), // size
        //s.pointColor(frame), // color
      ];
    }),
  ];
}

function getColorValues(
  frame: DataFrame,
  yIndex: number,
  cfg?: ColorDimensionConfig
): DimensionValues<CanvasRenderingContext2D['strokeStyle']> {
  let idx = findFieldIndex(frame, cfg?.field);
  if (idx == null) {
    if (cfg?.fixed) {
      return (frame: DataFrame, from?: number) => cfg.fixed;
    }
    idx = yIndex; // << use the y field color
  }

  // TODO: could be better :)
  return (frame: DataFrame, from?: number) => {
    const field = frame.fields[idx!];
    const dims = getColorDimensionForField(field, cfg!, config.theme2);
    return field.values.toArray().map((v, idx) => dims.get(idx));
  };
}

function getScaledValues(frame: DataFrame, yIndex: number, cfg?: ScaleDimensionConfig): DimensionValues<number> {
  let idx = findFieldIndex(frame, cfg?.field);
  if (idx == null) {
    if (cfg?.fixed) {
      return (frame: DataFrame, from?: number) => cfg.fixed;
    }
    idx = yIndex; // << use the y field color
  }

  // TODO: could be better :)
  return (frame: DataFrame, from?: number) => {
    const field = frame.fields[idx!];
    const dims = getScaledDimensionForField(field, cfg!);
    return field.values.toArray().map((v, idx) => dims.get(idx));
  };
}

function getTextValues(frame: DataFrame, yIndex: number, cfg?: TextDimensionConfig): DimensionValues<string> {
  let idx = findFieldIndex(frame, cfg?.field);
  if (idx == null) {
    if (cfg?.fixed) {
      return (frame: DataFrame, from?: number) => cfg.fixed;
    }
    idx = yIndex; // << use the y field color
  }

  // TODO: could be better :)
  return (frame: DataFrame, from?: number) => {
    const field = frame.fields[idx!];
    const dims = getTextDimensionForField(field, cfg!);
    return field.values.toArray().map((v, idx) => dims.get(idx));
  };
}
