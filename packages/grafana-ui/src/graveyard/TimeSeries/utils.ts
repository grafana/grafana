import { isNumber } from 'lodash';
import uPlot from 'uplot';

import {
  DashboardCursorSync,
  DataFrame,
  FieldConfig,
  FieldType,
  formattedValueToString,
  getFieldColorModeForField,
  getFieldSeriesColor,
  getFieldDisplayName,
  getDisplayProcessor,
  FieldColorModeId,
  DecimalCount,
} from '@grafana/data';
import {
  AxisPlacement,
  GraphDrawStyle,
  GraphFieldConfig,
  GraphThresholdsStyleMode,
  VisibilityMode,
  ScaleDirection,
  ScaleOrientation,
  StackingMode,
  GraphTransform,
  AxisColorMode,
  GraphGradientMode,
} from '@grafana/schema';

// unit lookup needed to determine if we want power-of-2 or power-of-10 axis ticks
// see categories.ts is @grafana/data
const IEC_UNITS = new Set([
  'bytes',
  'bits',
  'kbytes',
  'mbytes',
  'gbytes',
  'tbytes',
  'pbytes',
  'binBps',
  'binbps',
  'KiBs',
  'Kibits',
  'MiBs',
  'Mibits',
  'GiBs',
  'Gibits',
  'TiBs',
  'Tibits',
  'PiBs',
  'Pibits',
]);

const BIN_INCRS = Array(53);

for (let i = 0; i < BIN_INCRS.length; i++) {
  BIN_INCRS[i] = 2 ** i;
}

import { UPlotConfigBuilder, UPlotConfigPrepFn } from '../../components/uPlot/config/UPlotConfigBuilder';
import { getScaleGradientFn } from '../../components/uPlot/config/gradientFills';
import { getStackingGroups, preparePlotData2 } from '../../components/uPlot/utils';
import { buildScaleKey } from '../GraphNG/utils';

const defaultFormatter = (v: any, decimals: DecimalCount = 1) => (v == null ? '-' : v.toFixed(decimals));

const defaultConfig: GraphFieldConfig = {
  drawStyle: GraphDrawStyle.Line,
  showPoints: VisibilityMode.Auto,
  axisPlacement: AxisPlacement.Auto,
};

export const preparePlotConfigBuilder: UPlotConfigPrepFn<{
  sync?: () => DashboardCursorSync;
}> = ({
  frame,
  theme,
  timeZones,
  getTimeRange,
  sync,
  allFrames,
  renderers,
  tweakScale = (opts) => opts,
  tweakAxis = (opts) => opts,
}) => {
  const eventsScope = '__global_';

  const builder = new UPlotConfigBuilder(timeZones[0]);

  let alignedFrame: DataFrame;

  builder.setPrepData((frames) => {
    // cache alignedFrame
    alignedFrame = frames[0];

    return preparePlotData2(frames[0], builder.getStackingGroups());
  });

  // X is the first field in the aligned frame
  const xField = frame.fields[0];
  if (!xField) {
    return builder; // empty frame with no options
  }

  const xScaleKey = 'x';
  let yScaleKey = '';

  const xFieldAxisPlacement =
    xField.config.custom?.axisPlacement !== AxisPlacement.Hidden ? AxisPlacement.Bottom : AxisPlacement.Hidden;
  const xFieldAxisShow = xField.config.custom?.axisPlacement !== AxisPlacement.Hidden;

  if (xField.type === FieldType.time) {
    builder.addScale({
      scaleKey: xScaleKey,
      orientation: ScaleOrientation.Horizontal,
      direction: ScaleDirection.Right,
      isTime: true,
      range: () => {
        const r = getTimeRange();
        return [r.from.valueOf(), r.to.valueOf()];
      },
    });

    // filters first 2 ticks to make space for timezone labels
    const filterTicks: uPlot.Axis.Filter | undefined =
      timeZones.length > 1
        ? (u, splits) => {
            return splits.map((v, i) => (i < 2 ? null : v));
          }
        : undefined;

    for (let i = 0; i < timeZones.length; i++) {
      const timeZone = timeZones[i];
      builder.addAxis({
        scaleKey: xScaleKey,
        isTime: true,
        placement: xFieldAxisPlacement,
        show: xFieldAxisShow,
        label: xField.config.custom?.axisLabel,
        timeZone,
        theme,
        grid: { show: i === 0 && xField.config.custom?.axisGridShow },
        filter: filterTicks,
      });
    }

    // render timezone labels
    if (timeZones.length > 1) {
      builder.addHook('drawAxes', (u: uPlot) => {
        u.ctx.save();

        u.ctx.fillStyle = theme.colors.text.primary;
        u.ctx.textAlign = 'left';
        u.ctx.textBaseline = 'bottom';

        let i = 0;
        u.axes.forEach((a) => {
          if (a.side === 2) {
            //@ts-ignore
            let cssBaseline: number = a._pos + a._size;
            u.ctx.fillText(timeZones[i], u.bbox.left, cssBaseline * uPlot.pxRatio);
            i++;
          }
        });

        u.ctx.restore();
      });
    }
  } else {
    builder.addScale({
      scaleKey: xScaleKey,
      orientation: ScaleOrientation.Horizontal,
      direction: ScaleDirection.Right,
      range: (u, dataMin, dataMax) => [xField.config.min ?? dataMin, xField.config.max ?? dataMax],
    });

    builder.addAxis({
      scaleKey: xScaleKey,
      placement: xFieldAxisPlacement,
      show: xFieldAxisShow,
      label: xField.config.custom?.axisLabel,
      theme,
      grid: { show: xField.config.custom?.axisGridShow },
      formatValue: (v, decimals) => formattedValueToString(xField.display!(v, decimals)),
    });
  }

  let customRenderedFields =
    renderers?.flatMap((r) => Object.values(r.fieldMap).filter((name) => r.indicesOnly.indexOf(name) === -1)) ?? [];

  let indexByName: Map<string, number> | undefined;

  for (let i = 1; i < frame.fields.length; i++) {
    const field = frame.fields[i];

    const config: FieldConfig<GraphFieldConfig> = {
      ...field.config,
      custom: {
        ...defaultConfig,
        ...field.config.custom,
      },
    };

    const customConfig: GraphFieldConfig = config.custom!;

    if (field === xField || (field.type !== FieldType.number && field.type !== FieldType.enum)) {
      continue;
    }

    let fmt = field.display ?? defaultFormatter;
    if (field.config.custom?.stacking?.mode === StackingMode.Percent) {
      fmt = getDisplayProcessor({
        field: {
          ...field,
          config: {
            ...field.config,
            unit: 'percentunit',
          },
        },
        theme,
      });
    }
    const scaleKey = buildScaleKey(config, field.type);
    const colorMode = getFieldColorModeForField(field);
    const scaleColor = getFieldSeriesColor(field, theme);
    const seriesColor = scaleColor.color;

    // The builder will manage unique scaleKeys and combine where appropriate
    builder.addScale(
      tweakScale(
        {
          scaleKey,
          orientation: ScaleOrientation.Vertical,
          direction: ScaleDirection.Up,
          distribution: customConfig.scaleDistribution?.type,
          log: customConfig.scaleDistribution?.log,
          linearThreshold: customConfig.scaleDistribution?.linearThreshold,
          min: field.config.min,
          max: field.config.max,
          softMin: customConfig.axisSoftMin,
          softMax: customConfig.axisSoftMax,
          centeredZero: customConfig.axisCenteredZero,
          range:
            customConfig.stacking?.mode === StackingMode.Percent
              ? (u: uPlot, dataMin: number, dataMax: number) => {
                  dataMin = dataMin < 0 ? -1 : 0;
                  dataMax = dataMax > 0 ? 1 : 0;
                  return [dataMin, dataMax];
                }
              : field.type === FieldType.enum
                ? (u: uPlot, dataMin: number, dataMax: number) => {
                    // this is the exhaustive enum (stable)
                    let len = field.config.type!.enum!.text!.length;

                    return [-1, len];

                    // these are only values that are present
                    // return [dataMin - 1, dataMax + 1]
                  }
                : undefined,
          decimals: field.config.decimals,
        },
        field
      )
    );

    if (!yScaleKey) {
      yScaleKey = scaleKey;
    }

    if (customConfig.axisPlacement !== AxisPlacement.Hidden) {
      let axisColor: uPlot.Axis.Stroke | undefined;

      if (customConfig.axisColorMode === AxisColorMode.Series) {
        if (
          colorMode.isByValue &&
          field.config.custom?.gradientMode === GraphGradientMode.Scheme &&
          colorMode.id === FieldColorModeId.Thresholds
        ) {
          axisColor = getScaleGradientFn(1, theme, colorMode, field.config.thresholds);
        } else {
          axisColor = seriesColor;
        }
      }

      const axisDisplayOptions = {
        border: {
          show: customConfig.axisBorderShow || false,
          width: 1 / devicePixelRatio,
          stroke: axisColor || theme.colors.text.primary,
        },
        ticks: {
          show: customConfig.axisBorderShow || false,
          stroke: axisColor || theme.colors.text.primary,
        },
        color: axisColor || theme.colors.text.primary,
      };

      let incrs: uPlot.Axis.Incrs | undefined;

      // TODO: these will be dynamic with frame updates, so need to accept getYTickLabels()
      let values: uPlot.Axis.Values | undefined;
      let splits: uPlot.Axis.Splits | undefined;

      if (IEC_UNITS.has(config.unit!)) {
        incrs = BIN_INCRS;
      } else if (field.type === FieldType.enum) {
        let text = field.config.type!.enum!.text!;
        splits = text.map((v: string, i: number) => i);
        values = text;
      }

      builder.addAxis(
        tweakAxis(
          {
            scaleKey,
            label: customConfig.axisLabel,
            size: customConfig.axisWidth,
            placement: customConfig.axisPlacement ?? AxisPlacement.Auto,
            formatValue: (v, decimals) => formattedValueToString(fmt(v, decimals)),
            theme,
            grid: { show: customConfig.axisGridShow },
            decimals: field.config.decimals,
            distr: customConfig.scaleDistribution?.type,
            splits,
            values,
            incrs,
            ...axisDisplayOptions,
          },
          field
        )
      );
    }

    const showPoints =
      customConfig.drawStyle === GraphDrawStyle.Points ? VisibilityMode.Always : customConfig.showPoints;

    let pointsFilter: uPlot.Series.Points.Filter = () => null;

    if (customConfig.spanNulls !== true) {
      pointsFilter = (u, seriesIdx, show, gaps) => {
        let filtered = [];

        let series = u.series[seriesIdx];

        if (!show && gaps && gaps.length) {
          const [firstIdx, lastIdx] = series.idxs!;
          const xData = u.data[0];
          const yData = u.data[seriesIdx];
          const firstPos = Math.round(u.valToPos(xData[firstIdx], 'x', true));
          const lastPos = Math.round(u.valToPos(xData[lastIdx], 'x', true));

          if (gaps[0][0] === firstPos) {
            filtered.push(firstIdx);
          }

          // show single points between consecutive gaps that share end/start
          for (let i = 0; i < gaps.length; i++) {
            let thisGap = gaps[i];
            let nextGap = gaps[i + 1];

            if (nextGap && thisGap[1] === nextGap[0]) {
              // approx when data density is > 1pt/px, since gap start/end pixels are rounded
              let approxIdx = u.posToIdx(thisGap[1], true);

              if (yData[approxIdx] == null) {
                // scan left/right alternating to find closest index with non-null value
                for (let j = 1; j < 100; j++) {
                  if (yData[approxIdx + j] != null) {
                    approxIdx += j;
                    break;
                  }
                  if (yData[approxIdx - j] != null) {
                    approxIdx -= j;
                    break;
                  }
                }
              }

              filtered.push(approxIdx);
            }
          }

          if (gaps[gaps.length - 1][1] === lastPos) {
            filtered.push(lastIdx);
          }
        }

        return filtered.length ? filtered : null;
      };
    }

    let { fillOpacity } = customConfig;

    let pathBuilder: uPlot.Series.PathBuilder | null = null;
    let pointsBuilder: uPlot.Series.Points.Show | null = null;

    if (field.state?.origin) {
      if (!indexByName) {
        indexByName = getNamesToFieldIndex(frame, allFrames);
      }

      const originFrame = allFrames[field.state.origin.frameIndex];
      const originField = originFrame?.fields[field.state.origin.fieldIndex];

      const dispName = getFieldDisplayName(originField ?? field, originFrame, allFrames);

      // disable default renderers
      if (customRenderedFields.indexOf(dispName) >= 0) {
        pathBuilder = () => null;
        pointsBuilder = () => undefined;
      } else if (customConfig.transform === GraphTransform.Constant) {
        // patch some monkeys!
        const defaultBuilder = uPlot.paths!.linear!();

        pathBuilder = (u, seriesIdx) => {
          //eslint-disable-next-line
          const _data: any[] = (u as any)._data; // uplot.AlignedData not exposed in types

          // the data we want the line renderer to pull is x at each plot edge with paired flat y values

          const r = getTimeRange();
          let xData = [r.from.valueOf(), r.to.valueOf()];
          let firstY = _data[seriesIdx].find((v: number | null | undefined) => v != null);
          let yData = [firstY, firstY];
          let fauxData = _data.slice();
          fauxData[0] = xData;
          fauxData[seriesIdx] = yData;

          //eslint-disable-next-line
          return defaultBuilder(
            {
              ...u,
              _data: fauxData,
            } as any,
            seriesIdx,
            0,
            1
          );
        };
      }

      if (customConfig.fillBelowTo) {
        const fillBelowToField = frame.fields.find(
          (f) =>
            customConfig.fillBelowTo === f.name ||
            customConfig.fillBelowTo === f.config?.displayNameFromDS ||
            customConfig.fillBelowTo === getFieldDisplayName(f, frame, allFrames)
        );

        const fillBelowDispName = fillBelowToField
          ? getFieldDisplayName(fillBelowToField, frame, allFrames)
          : customConfig.fillBelowTo;

        const t = indexByName.get(dispName);
        const b = indexByName.get(fillBelowDispName);
        if (isNumber(b) && isNumber(t)) {
          builder.addBand({
            series: [t, b],
            fill: undefined, // using null will have the band use fill options from `t`
          });

          if (!fillOpacity) {
            fillOpacity = 35; // default from flot
          }
        } else {
          fillOpacity = 0;
        }
      }
    }

    let dynamicSeriesColor: ((seriesIdx: number) => string | undefined) | undefined = undefined;

    if (colorMode.id === FieldColorModeId.Thresholds) {
      dynamicSeriesColor = (seriesIdx) => getFieldSeriesColor(alignedFrame.fields[seriesIdx], theme).color;
    }

    builder.addSeries({
      pathBuilder,
      pointsBuilder,
      scaleKey,
      showPoints,
      pointsFilter,
      colorMode,
      fillOpacity,
      theme,
      dynamicSeriesColor,
      drawStyle: customConfig.drawStyle!,
      lineColor: customConfig.lineColor ?? seriesColor,
      lineWidth: customConfig.lineWidth,
      lineInterpolation: customConfig.lineInterpolation,
      lineStyle: customConfig.lineStyle,
      barAlignment: customConfig.barAlignment,
      barWidthFactor: customConfig.barWidthFactor,
      barMaxWidth: customConfig.barMaxWidth,
      pointSize: customConfig.pointSize,
      spanNulls: customConfig.spanNulls || false,
      show: !customConfig.hideFrom?.viz,
      gradientMode: customConfig.gradientMode,
      thresholds: config.thresholds,
      hardMin: field.config.min,
      hardMax: field.config.max,
      softMin: customConfig.axisSoftMin,
      softMax: customConfig.axisSoftMax,
      // The following properties are not used in the uPlot config, but are utilized as transport for legend config
      dataFrameFieldIndex: field.state?.origin,
    });

    // Render thresholds in graph
    if (customConfig.thresholdsStyle && config.thresholds) {
      const thresholdDisplay = customConfig.thresholdsStyle.mode ?? GraphThresholdsStyleMode.Off;
      if (thresholdDisplay !== GraphThresholdsStyleMode.Off) {
        builder.addThresholds({
          config: customConfig.thresholdsStyle,
          thresholds: config.thresholds,
          scaleKey,
          theme,
          hardMin: field.config.min,
          hardMax: field.config.max,
          softMin: customConfig.axisSoftMin,
          softMax: customConfig.axisSoftMax,
        });
      }
    }
  }

  let stackingGroups = getStackingGroups(frame);

  builder.setStackingGroups(stackingGroups);

  // hook up custom/composite renderers
  renderers?.forEach((r) => {
    if (!indexByName) {
      indexByName = getNamesToFieldIndex(frame, allFrames);
    }
    let fieldIndices: Record<string, number> = {};

    for (let key in r.fieldMap) {
      let dispName = r.fieldMap[key];
      fieldIndices[key] = indexByName.get(dispName)!;
    }

    r.init(builder, fieldIndices);
  });

  builder.scaleKeys = [xScaleKey, yScaleKey];

  // if hovered value is null, how far we may scan left/right to hover nearest non-null
  const hoverProximityPx = 15;

  let cursor: Partial<uPlot.Cursor> = {
    // this scans left and right from cursor position to find nearest data index with value != null
    // TODO: do we want to only scan past undefined values, but halt at explicit null values?
    dataIdx: (self, seriesIdx, hoveredIdx, cursorXVal) => {
      let seriesData = self.data[seriesIdx];

      if (seriesData[hoveredIdx] == null) {
        let nonNullLft = null,
          nonNullRgt = null,
          i;

        i = hoveredIdx;
        while (nonNullLft == null && i-- > 0) {
          if (seriesData[i] != null) {
            nonNullLft = i;
          }
        }

        i = hoveredIdx;
        while (nonNullRgt == null && i++ < seriesData.length) {
          if (seriesData[i] != null) {
            nonNullRgt = i;
          }
        }

        let xVals = self.data[0];

        let curPos = self.valToPos(cursorXVal, 'x');
        let rgtPos = nonNullRgt == null ? Infinity : self.valToPos(xVals[nonNullRgt], 'x');
        let lftPos = nonNullLft == null ? -Infinity : self.valToPos(xVals[nonNullLft], 'x');

        let lftDelta = curPos - lftPos;
        let rgtDelta = rgtPos - curPos;

        if (lftDelta <= rgtDelta) {
          if (lftDelta <= hoverProximityPx) {
            hoveredIdx = nonNullLft!;
          }
        } else {
          if (rgtDelta <= hoverProximityPx) {
            hoveredIdx = nonNullRgt!;
          }
        }
      }

      return hoveredIdx;
    },
  };

  if (sync && sync() !== DashboardCursorSync.Off) {
    cursor.sync = {
      key: eventsScope,
      scales: [xScaleKey, null],
    };
  }

  builder.setCursor(cursor);

  return builder;
};

export function getNamesToFieldIndex(frame: DataFrame, allFrames: DataFrame[]): Map<string, number> {
  const originNames = new Map<string, number>();
  frame.fields.forEach((field, i) => {
    const origin = field.state?.origin;
    if (origin) {
      const origField = allFrames[origin.frameIndex]?.fields[origin.fieldIndex];
      if (origField) {
        originNames.set(getFieldDisplayName(origField, allFrames[origin.frameIndex], allFrames), i);
      }
    }
  });
  return originNames;
}
