import {
  DataFrame,
  getFieldColorModeForField,
  getFieldDisplayName,
  getFieldSeriesColor,
  GrafanaTheme2,
  PanelData,
} from '@grafana/data';
import { AxisPlacement, ScaleDirection, ScaleOrientation, VisibilityMode } from '@grafana/schema';
import { UPlotConfigBuilder } from '@grafana/ui';
import { FacetedData, FacetSeries } from '@grafana/ui/src/components/uPlot/types';
import { findFieldIndex, ScaleDimensionConfig } from 'app/features/dimensions';
import { config } from '@grafana/runtime';
import { defaultScatterConfig, ScatterFieldConfig, XYChartOptions } from './models.gen';
import { pointWithin, Quadtree, Rect } from '../barchart/quadtree';
import { alpha } from '@grafana/data/src/themes/colorManipulator';
import uPlot from 'uplot';
import { ScatterHoverCallback, ScatterSeries } from './types';
import { isGraphable } from './dims';

export interface ScatterPanelInfo {
  error?: string;
  series: ScatterSeries[];
  builder?: UPlotConfigBuilder;
}

/**
 * This is called when options or structure rev changes
 */
export function prepScatter(
  options: XYChartOptions,
  data: PanelData,
  theme: GrafanaTheme2,
  ttip: ScatterHoverCallback
): ScatterPanelInfo {
  let series: ScatterSeries[];
  let builder: UPlotConfigBuilder;

  try {
    series = prepSeries(options, data.series);
    builder = prepConfig(data.series, series, theme, ttip);
  } catch (e) {
    console.log('prepScatter ERROR', e);
    return {
      error: e.message,
      series: [],
    };
  }

  return {
    series,
    builder,
  };
}

interface Dims {
  pointColorIndex?: number;
  pointColorFixed?: string;

  pointSizeIndex?: number;
  pointSizeConfig?: ScaleDimensionConfig;
}

function getScatterSeries(
  seriesIndex: number,
  frames: DataFrame[],
  frameIndex: number,
  xIndex: number,
  yIndex: number,
  dims: Dims
): ScatterSeries {
  const frame = frames[frameIndex];
  const y = frame.fields[yIndex];
  let state = y.state ?? {};
  state.seriesIndex = seriesIndex;
  y.state = state;

  // can be used to generate pointColor from thresholds, or text labels with formatting
  // const disp =
  //   y.display ??
  //   getDisplayProcessor({
  //     field: y,
  //     theme: config.theme2,
  //     timeZone: tz,
  //   });

  // Simple hack for now!
  const seriesColor = getFieldSeriesColor(y, config.theme2).color;
  const fieldConfig: ScatterFieldConfig = { ...defaultScatterConfig, ...y.config.custom };

  console.log('TODO, use config', { ...dims });

  const name = getFieldDisplayName(y, frame, frames);
  return {
    name,

    frame: (frames) => frames[frameIndex],

    x: (frame) => frame.fields[xIndex],
    y: (frame) => frame.fields[yIndex],
    legend: (frame) => {
      return [
        {
          label: name,
          color: seriesColor, // single color for series?
          getItemKey: () => name,
          yAxis: yIndex, // << but not used
        },
      ];
    },

    line: fieldConfig.line!,
    lineWidth: fieldConfig.lineWidth!,
    lineStyle: fieldConfig.lineStyle!,
    lineColor: () => seriesColor,

    point: fieldConfig.point!,
    pointSize: () => fieldConfig.pointSize?.fixed ?? 3, // hardcoded for now
    pointColor: () => seriesColor,
    pointSymbol: (frame: DataFrame, from?: number) => 'circle', // single field, multiple symbols.... kinda equals multiple series 🤔

    label: VisibilityMode.Never,
    labelValue: () => '',

    hints: {
      pointSize: fieldConfig.pointSize!,
      pointColor: {
        mode: getFieldColorModeForField(y),
      },
    },
  };
}

function prepSeries(options: XYChartOptions, frames: DataFrame[]): ScatterSeries[] {
  let seriesIndex = 0;
  if (!frames.length) {
    throw 'missing data';
  }

  if (options.mode === 'explicit') {
    if (options.series?.length) {
      for (const series of options.series) {
        if (!series?.x) {
          throw 'Select X dimension';
        }

        if (!series?.y) {
          throw 'Select Y dimension';
        }

        for (let frameIndex = 0; frameIndex < frames.length; frameIndex++) {
          const frame = frames[frameIndex];
          const xIndex = findFieldIndex(frame, series.x);

          if (xIndex != null) {
            // TODO: this should find multiple y fields
            const yIndex = findFieldIndex(frame, series.y);

            if (yIndex == null) {
              throw 'Y must be in the same frame as X';
            }

            const dims: Dims = {
              pointColorFixed: series.pointColor?.fixed,
              pointColorIndex: findFieldIndex(frame, series.pointColor?.field),
              pointSizeConfig: series.pointSize,
              pointSizeIndex: findFieldIndex(frame, series.pointSize?.field),
            };
            return [getScatterSeries(seriesIndex++, frames, frameIndex, xIndex, yIndex, dims)];
          }
        }
      }
    }
  }

  // Default behavior
  const dims = options.dims ?? {};
  const frameIndex = dims.frame ?? 0;
  const frame = frames[frameIndex];
  const numericIndicies: number[] = [];

  let xIndex = findFieldIndex(frame, dims.x);
  for (let i = 0; i < frame.fields.length; i++) {
    if (isGraphable(frame.fields[i])) {
      if (xIndex == null || i === xIndex) {
        xIndex = i;
        continue;
      }
      if (dims.exclude && dims.exclude.includes(getFieldDisplayName(frame.fields[i], frame, frames))) {
        continue; // skip
      }

      numericIndicies.push(i);
    }
  }

  if (xIndex == null) {
    throw 'Missing X dimension';
  }

  if (!numericIndicies.length) {
    throw 'No Y values';
  }
  return numericIndicies.map((yIndex) => getScatterSeries(seriesIndex++, frames, frameIndex, xIndex!, yIndex, {}));
}

interface DrawBubblesOpts {
  each: (u: uPlot, seriesIdx: number, dataIdx: number, lft: number, top: number, wid: number, hgt: number) => void;
  disp: {
    //unit: 3,
    size: {
      values: (u: uPlot, seriesIdx: number) => number[];
    };
  };
}

//const prepConfig: UPlotConfigPrepFnXY<XYChartOptions> = ({ frames, series, theme }) => {
const prepConfig = (
  frames: DataFrame[],
  scatterSeries: ScatterSeries[],
  theme: GrafanaTheme2,
  ttip: ScatterHoverCallback
) => {
  let qt: Quadtree;
  let hRect: Rect | null;

  function drawBubblesFactory(opts: DrawBubblesOpts) {
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

          // leon forgot to add these to the uPlot's Scale interface, but they exist!
          //let xKey = scaleX.key as string;
          //let yKey = scaleY.key as string;
          let xKey = series.facets![0].scale;
          let yKey = series.facets![1].scale;

          let pointHints = scatterSeries[seriesIdx - 1].hints.pointSize;

          let maxSize = (pointHints.max ?? pointHints.fixed) * devicePixelRatio;

          // todo: this depends on direction & orientation
          // todo: calc once per redraw, not per path
          let filtLft = u.posToVal(-maxSize / 2, xKey);
          let filtRgt = u.posToVal(u.bbox.width / devicePixelRatio + maxSize / 2, xKey);
          let filtBtm = u.posToVal(u.bbox.height / devicePixelRatio + maxSize / 2, yKey);
          let filtTop = u.posToVal(-maxSize / 2, yKey);

          let sizes = opts.disp.size.values(u, seriesIdx);

          for (let i = 0; i < d[0].length; i++) {
            let xVal = d[0][i];
            let yVal = d[1][i];
            let size = sizes[i] * devicePixelRatio;

            if (xVal >= filtLft && xVal <= filtRgt && yVal >= filtBtm && yVal <= filtTop) {
              let cx = valToPosX(xVal, scaleX, xDim, xOff);
              let cy = valToPosY(yVal, scaleY, yDim, yOff);

              u.ctx.moveTo(cx + size / 2, cy);
              u.ctx.beginPath();
              u.ctx.arc(cx, cy, size / 2, 0, deg360);
              u.ctx.fill();
              u.ctx.stroke();
              opts.each(
                u,
                seriesIdx,
                i,
                cx - size / 2 - strokeWidth / 2,
                cy - size / 2 - strokeWidth / 2,
                size + strokeWidth,
                size + strokeWidth
              );
            }
          }

          u.ctx.restore();
        }
      );

      return null;
    };

    return drawBubbles;
  }

  let drawBubbles = drawBubblesFactory({
    disp: {
      size: {
        //unit: 3, // raw CSS pixels
        values: (u, seriesIdx) => {
          return u.data[seriesIdx][2] as any; // already contains final pixel geometry
          //let [minValue, maxValue] = getSizeMinMax(u);
          //return u.data[seriesIdx][2].map(v => getSize(v, minValue, maxValue));
        },
      },
    },
    each: (u, seriesIdx, dataIdx, lft, top, wid, hgt) => {
      // we get back raw canvas coords (included axes & padding). translate to the plotting area origin
      lft -= u.bbox.left;
      top -= u.bbox.top;
      qt.add({ x: lft, y: top, w: wid, h: hgt, sidx: seriesIdx, didx: dataIdx });
    },
  });

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

  let rect: DOMRect;

  // rect of .u-over (grid area)
  builder.addHook('syncRect', (u, r) => {
    console.log(r);
    rect = r;
  });

  builder.addHook('setCursor', (u) => {
    // hovered value indices in each series
    console.log(u.cursor.idxs);
    // coords within .u-over rect
    console.log(u.cursor.left, u.cursor.top);
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

  let xField = scatterSeries[0].x(scatterSeries[0].frame(frames));

  builder.addScale({
    scaleKey: 'x',
    isTime: false,
    orientation: ScaleOrientation.Horizontal,
    direction: ScaleDirection.Right,
    range: (u, min, max) => [min, max],
  });

  builder.addAxis({
    scaleKey: 'x',
    placement: AxisPlacement.Bottom,
    theme,
    label: xField.config.custom.axisLabel,
  });

  scatterSeries.forEach((s) => {
    let frame = s.frame(frames);
    let field = s.y(frame);

    const lineColor = s.lineColor(frame) as string;
    const fillColor = s.pointColor(frame) as string;
    //const lineColor = s.lineColor(frame);
    //const lineWidth = s.lineWidth;

    let scaleKey = field.config.unit ?? 'y';

    builder.addScale({
      scaleKey,
      orientation: ScaleOrientation.Vertical,
      direction: ScaleDirection.Up,
      range: (u, min, max) => [min, max],
    });

    builder.addAxis({
      scaleKey,
      theme,
      label: field.config.custom.axisLabel,
      values: (u, splits) => splits.map((s) => field.display!(s).text),
    });

    builder.addSeries({
      facets: [
        {
          scale: 'x',
          auto: true,
        },
        {
          scale: scaleKey,
          auto: true,
        },
      ],
      pathBuilder: drawBubbles, // drawBubbles({disp: {size: {values: () => }}})
      theme,
      scaleKey: '', // facets' scales used (above)
      lineColor: lineColor,
      fillColor: alpha(fillColor, 0.5),
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
      const pointSize = Number(s.pointSize(frame)); // constant!
      // TODO obviously add color etc etc
      return [
        s.x(frame).values.toArray(), // X
        s.y(frame).values.toArray(), // Y
        Array(frame.length).fill(pointSize), // constant for now
        //s.pointSize(frame), // size
        //s.pointColor(frame), // color
      ];
    }),
  ];
}
