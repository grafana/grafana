import { DataFrame, DataFrameFieldIndex, getFieldDisplayName, getFieldSeriesColor } from '@grafana/data';
import { ScatterFrameFieldMap } from './types';
import {
  AxisPlacement,
  FieldLookup,
  ScaleDirection,
  ScaleOrientation,
  UPlotConfigBuilder,
  UPlotConfigPrepFnXY,
} from '@grafana/ui';
import uPlot from 'uplot';
import { FacetSeries } from '@grafana/ui/src/components/uPlot/types';
import { pointWithin, Quadtree, Rect } from '../barchart/quadtree';
import { alpha } from '@grafana/data/src/themes/colorManipulator';
import { defaultScatterConfig, ScatterSeries, XYChartOptions, ScatterLineMode } from './models.gen';
import {
  findFieldIndex,
  getColorDimension,
  getColorDimensionForField,
  getScaledDimensionForField,
  getTextDimensionForField,
  TextDimensionMode,
} from 'app/features/dimensions';
import { config } from '@grafana/runtime';
import { VisibilityMode } from '@grafana/schema';

// This is called the 1st time structure and options change
// This will consolidate the configuration into a set of series
export function prepDims(options: XYChartOptions, frames: DataFrame[]): { warn?: string; series: ScatterSeries[] } {
  if (!frames.length) {
    return { warn: 'No data', series: [] };
  }

  const series: ScatterSeries[] = [];
  if (options.mode === 'single') {
    const { single } = options;
    if (!single?.x) {
      return {
        warn: `Select X dimension`,
        series,
      };
    }
    if (!single?.y) {
      return {
        warn: `Select Y dimension`,
        series,
      };
    }

    for (let frameIndex = 0; frameIndex < frames.length; frameIndex++) {
      const frame = frames[frameIndex];
      const xIndex = findFieldIndex(frame, single.x);
      if (xIndex != null) {
        const yIndex = findFieldIndex(frame, single.y);
        if (yIndex == null) {
          return {
            warn: `Y must be in the same frame as X`,
            series,
          };
        }

        const y = frame.fields[xIndex];
        series.push({
          ...defaultScatterConfig,
          ...y.config?.custom,
          frameIndex,
          xIndex,
          yIndex,
        });
        return { series };
      }
    }
  }

  return {
    warn: `Unsupported mode: ${options.mode}`,
    series,
  };
  // const cfg = options.series ?? {};

  // // field indices found in first frame
  // let xIdx = -1;
  // let yIdx = -1;
  // let colorIdx = -1;
  // let sizeIdx = -1;
  // let labelIdx = -1;

  // return frames.map((frame, i) => {
  //   // map first frame by field names
  //   if (i === 0) {
  //     const series: ScatterSeries = {
  //       x: findField(frame, cfg.x),
  //       y: findField(frame, cfg.y),

  //       color: getColorDimension(frame, cfg.color ?? { fixed: '#F00' }, config.theme2),
  //       size: getScaledDimension(frame, cfg.size ?? { fixed: 5, min: 1, max: 5 }),
  //       label: cfg.label ? getTextDimension(frame, cfg.label) : undefined,

  //       name: 'hello',
  //       frame,
  //     };

  //     xIdx = frame.fields.findIndex((field) => field === series.x);
  //     yIdx = frame.fields.findIndex((field) => field === series.y);
  //     colorIdx = series.color.field ? frame.fields.findIndex((field) => field === series.color.field) : -1;
  //     sizeIdx = series.size?.field ? frame.fields.findIndex((field) => field === series.size?.field) : -1;
  //     labelIdx = series.label?.field ? frame.fields.findIndex((field) => field === series.label?.field) : -1;

  //     return series;
  //   }
  //   // map remaining frames by indicies of fields found in first frame
  //   else {
  //     let colorCfg: ColorDimensionConfig =
  //       colorIdx > -1 ? { ...cfg.color!, field: getFieldDisplayName(frame.fields[colorIdx], frame) } : cfg.color!;

  //     let sizeCfg: ScaleDimensionConfig =
  //       sizeIdx > -1 ? { ...cfg.size!, field: getFieldDisplayName(frame.fields[sizeIdx], frame) } : cfg.size!;

  //     let labelCfg: TextDimensionConfig =
  //       labelIdx > -1 ? { ...cfg.label!, field: getFieldDisplayName(frame.fields[labelIdx], frame) } : cfg.label!;

  //     const series: ScatterSeries = {
  //       x: frame.fields[xIdx],
  //       y: frame.fields[yIdx],

  //       color: getColorDimension(frame, colorCfg, config.theme2),
  //       size: getScaledDimension(frame, sizeCfg),
  //       label: labelCfg ? getTextDimension(frame, labelCfg) : undefined,

  //       name: 'hello',
  //       frame,
  //     };

  //     return series;
  //   }
  // });
}

type PrepFieldLookup = (dims: ScatterSeries[], frames: DataFrame[]) => FieldLookup<ScatterFrameFieldMap>;

export const prepLookup: PrepFieldLookup = (dims, frames) => {
  const byIndex = new Map<number, DataFrameFieldIndex>();
  const byName = new Map<string, DataFrameFieldIndex>();

  // ??? all arrays will be of length dims.length ???
  const fieldMaps: ScatterFrameFieldMap[] = frames.map((frame, frameIndex) => {
    frame.fields.forEach((field, fieldIndex) => {
      const displayName = getFieldDisplayName(field, frame, frames);
      const fieldOrigin = {
        frameIndex,
        fieldIndex,
        //   seriesIndex,
        displayName,
        // frameSeriesIndex: acc.length,
      };

      //   byIndex.set(seriesIndex, fieldOrigin);  <<< multiple series in one frame ???
      byName.set(displayName, fieldOrigin);
    });

    return {
      frameIndex, // << the only real field
      x: [],
      y: [],
      tooltip: [],
      legend: [],

      line: [],
      lineWidth: [],
      lineStyle: [],
      lineColor: [],

      point: [],
      pointSize: [],
      pointColor: [],

      label: [],
      labelValue: [],
    };
  });

  for (let seriesIdx = 0; seriesIdx < dims.length; seriesIdx++) {
    const seriesConfig = dims[seriesIdx];
    const fieldMap = fieldMaps[seriesConfig.frameIndex];
    const frame = frames[seriesConfig.frameIndex];

    fieldMap.x.push(seriesConfig.xIndex);
    fieldMap.y.push(seriesConfig.yIndex);
    fieldMap.tooltip!.push([seriesConfig.xIndex, seriesConfig.yIndex]);
    fieldMap.legend!.push([seriesConfig.yIndex]);

    fieldMap.line!.push(seriesConfig.line ?? ScatterLineMode.None);
    fieldMap.lineWidth!.push(seriesConfig.lineWidth ?? defaultScatterConfig.lineWidth!);
    fieldMap.lineStyle!.push(seriesConfig.lineStyle ?? defaultScatterConfig.lineStyle!);

    let color = getColorDimension(frame, seriesConfig.lineColor ?? { fixed: 'red' }, config.theme2);
    fieldMap.lineColor!.push(color.fixed ?? 'blue'); // solid or gradient

    fieldMap.point!.push(seriesConfig.point ?? VisibilityMode.Auto);
    const scaleIndex = findFieldIndex(frame, seriesConfig.pointSize?.field);
    if (scaleIndex == null) {
      const fixed = seriesConfig.pointSize?.fixed ?? 5;
      fieldMap.pointSize!.push((frame: DataFrame, from?: number) => fixed);
    } else {
      fieldMap.pointSize!.push((frame: DataFrame, from?: number) => {
        const field = frame.fields[scaleIndex];
        const dims = getScaledDimensionForField(field, seriesConfig.pointSize ?? defaultScatterConfig.pointSize!);
        return field.values.toArray().map((v, idx) => dims.get(idx)); // could be better :)
      });
    }

    const pointColorIndex = findFieldIndex(frame, seriesConfig.pointColor?.field);
    if (pointColorIndex == null) {
      const fixed = seriesConfig.pointColor?.fixed ?? '#FF0';
      fieldMap.pointColor!.push((frame: DataFrame, from?: number) => fixed);
    } else {
      fieldMap.pointColor!.push((frame: DataFrame, from?: number) => {
        const field = frame.fields[pointColorIndex];
        const dims = getColorDimensionForField(field, seriesConfig.pointColor ?? { fixed: 'red' }, config.theme2);
        return field.values.toArray().map((v, idx) => dims.get(idx)); // could be better :)
      });
    }

    fieldMap.label!.push(seriesConfig.label ?? VisibilityMode.Auto);
    fieldMap.labelValue!.push((frame: DataFrame, from?: number) => {
      const field = frame.fields[seriesConfig.yIndex];
      const dims = getTextDimensionForField(
        field,
        seriesConfig.labelValue ?? { mode: TextDimensionMode.Field, fixed: '' }
      );
      return field.values.toArray().map((v, idx) => dims.get(idx)); // could be better :)
    });
  }

  return {
    fieldMaps,
    byIndex,
    byName,
    setIndices(frames) {
      byIndex.forEach(({ frameIndex, fieldIndex, seriesIndex }) => {
        let field = frames[frameIndex].fields[fieldIndex];
        let state = field.state ?? {};
        state.seriesIndex = seriesIndex;
        field.state = state;
      });
    },
  };
};

export const prepConfig: UPlotConfigPrepFnXY<XYChartOptions> = ({
  mode,
  frames,
  lookup,
  theme,
  eventBus,
  ...options
}) => {
  let qt: Quadtree;
  let hRect: Rect | null;

  // temp
  //let minSize = 6;
  let maxSize = 60;

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

        for (let i = 0; i < d[0].length; i++) {
          let xVal = d[0][i];
          let yVal = d[1][i];
          let size = d[2][i];

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

  lookup.setIndices(frames);

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

  lookup.fieldMaps.forEach((map, frameIndex) => {
    map.y.forEach((fieldIndex, frameSeriesIndex) => {
      let field = frames[frameIndex].fields[fieldIndex];

      const scaleColor = getFieldSeriesColor(field, theme);
      const seriesColor = scaleColor.color;

      builder.addSeries({
        pathBuilder: drawBubbles,
        theme,
        scaleKey: '', // facets' scales used internally (x/y)
        lineColor: seriesColor,
        fillColor: alpha(seriesColor, 0.5),
      });
    });
  });

  builder.setPrepData((frames) => {
    lookup.setIndices(frames);

    let seriesData = lookup.fieldMaps.flatMap((f, i) => {
      let { fields } = frames[i];

      return f.y.map((yIndex, frameSeriesIndex) => {
        let xValues = fields[f.x[frameSeriesIndex]].values.toArray();
        let yValues = fields[f.y[frameSeriesIndex]].values.toArray();
        let sizeValues: any = 5; // f.size![frameSeriesIndex](frames[i]);

        if (!Array.isArray(sizeValues)) {
          sizeValues = Array(xValues.length).fill(sizeValues);
        }

        return [xValues, yValues, sizeValues];
      });
    });

    return [null, ...seriesData];
  });

  return builder;
};
