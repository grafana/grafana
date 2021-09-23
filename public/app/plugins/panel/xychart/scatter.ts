import { DataFrame, getFieldDisplayName, getFieldSeriesColor, GrafanaTheme2, PanelData } from '@grafana/data';
import { AxisPlacement, ScaleDirection, ScaleOrientation, VisibilityMode } from '@grafana/schema';
import { UPlotConfigBuilder } from '@grafana/ui';
import { FacetedData, FacetSeries } from '@grafana/ui/src/components/uPlot/types';
import { findFieldIndex } from 'app/features/dimensions';
import { config } from '@grafana/runtime';
import { defaultScatterConfig, ScatterFieldConfig, XYChartOptions } from './models.gen';
import { pointWithin, Quadtree, Rect } from '../barchart/quadtree';
import { alpha } from '@grafana/data/src/themes/colorManipulator';
import uPlot from 'uplot';
import { ScatterSeries } from './types';
import { isGraphable } from './dims';

export interface ScatterPanelInfo {
  error?: string;
  series: ScatterSeries[];
  builder?: UPlotConfigBuilder;
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
      series: [],
    };
  }

  return {
    series,
    builder,
  };
}

function getScatterSeries(
  seriesIndex: number,
  frames: DataFrame[],
  frameIndex: number,
  xIndex: number,
  yIndex: number
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
  };
}

function prepSeries(options: XYChartOptions, frames: DataFrame[]): ScatterSeries[] {
  let seriesIndex = 0;
  if (!frames.length) {
    throw 'missing data';
  }

  if (options.mode === 'xy') {
    const { dims } = options;
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
    return numericIndicies.map((yIndex) => getScatterSeries(seriesIndex++, frames, frameIndex, xIndex!, yIndex));
  }

  if (options.mode === 'single') {
    const { single } = options;

    if (!single?.x) {
      throw 'Select X dimension';
    }

    if (!single?.y) {
      throw 'Select Y dimension';
    }

    for (let frameIndex = 0; frameIndex < frames.length; frameIndex++) {
      const frame = frames[frameIndex];
      const xIndex = findFieldIndex(frame, single.x);

      if (xIndex != null) {
        // TODO: this should find multiple y fields
        const yIndex = findFieldIndex(frame, single.y);

        if (yIndex == null) {
          throw 'Y must be in the same frame as X';
        }

        return [getScatterSeries(seriesIndex++, frames, frameIndex, xIndex, yIndex)];
      }
    }
  }

  return [];
}

//const prepConfig: UPlotConfigPrepFnXY<XYChartOptions> = ({ frames, series, theme }) => {
const prepConfig = (frames: DataFrame[], series: ScatterSeries[], theme: GrafanaTheme2) => {
  let qt: Quadtree;
  let hRect: Rect | null;

  // size range in pixels (diameter)
  let minSize = 6;
  let maxSize = 60;

  // let maxArea = maxSize ** 2;
  // let minArea = minSize ** 2;

  // // quadratic scaling (px area)
  // function getSize(value: number, minValue: number, maxValue: number) {
  //   let pct = value / (maxValue - minValue);
  //   let area = minArea + pct * (maxArea - minArea);
  //   return Math.sqrt(area);
  // }

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

        // todo: this depends on direction & orientation
        // todo: calc once per redraw, not per path
        let filtLft = u.posToVal(-maxSize / 2, xKey);
        let filtRgt = u.posToVal(u.bbox.width / devicePixelRatio + maxSize / 2, xKey);
        let filtBtm = u.posToVal(u.bbox.height / devicePixelRatio + maxSize / 2, yKey);
        let filtTop = u.posToVal(-maxSize / 2, yKey);

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
          let size = 20; // ??? // getSize(d[2][i], minValue, maxValue);

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

  builder.addAxis({
    scaleKey: 'x',
    placement: AxisPlacement.Bottom,
    theme,
  });

  series.forEach((s) => {
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
