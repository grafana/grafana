import { isNumber } from 'lodash';
import uPlot from 'uplot';

import {
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
// eslint-disable-next-line import/order
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
  VizOrientation,
  ScaleDistributionConfig,
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

import { DrawStyle } from '@grafana/ui';
import {
  UPlotConfigBuilder,
  UPlotConfigPrepFn,
  getScaleGradientFn,
  buildScaleKey,
  getStackingGroups,
  preparePlotData2,
} from '@grafana/ui/internal';

const defaultFormatter = (v: any, decimals: DecimalCount = 1) => (v == null ? '-' : v.toFixed(decimals));

const defaultConfig: GraphFieldConfig = {
  drawStyle: GraphDrawStyle.Line,
  showPoints: VisibilityMode.Auto,
  axisPlacement: AxisPlacement.Auto,
  showValues: false,
};

export const preparePlotConfigBuilder: UPlotConfigPrepFn = ({
  frame,
  theme,
  timeZones,
  getTimeRange,
  allFrames,
  renderers,
  tweakScale = (opts) => opts,
  tweakAxis = (opts) => opts,
  hoverProximity,
  orientation = VizOrientation.Horizontal,
}) => {
  // we want the Auto and Horizontal orientation to default to Horizontal
  const isHorizontal = orientation !== VizOrientation.Vertical;
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
    xField.config.custom?.axisPlacement === AxisPlacement.Hidden
      ? AxisPlacement.Hidden
      : isHorizontal
        ? AxisPlacement.Bottom
        : AxisPlacement.Left;
  const xFieldAxisShow = xField.config.custom?.axisPlacement !== AxisPlacement.Hidden;

  if (xField.type === FieldType.time) {
    builder.addScale({
      scaleKey: xScaleKey,
      orientation: isHorizontal ? ScaleOrientation.Horizontal : ScaleOrientation.Vertical,
      direction: isHorizontal ? ScaleDirection.Right : ScaleDirection.Up,
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
            if (isHorizontal) {
              return splits.map((v, i) => (i < 2 ? null : v));
            }
            return splits;
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

        let i = 0;
        u.axes.forEach((a) => {
          if (isHorizontal && a.side === 2) {
            u.ctx.fillStyle = theme.colors.text.primary;
            u.ctx.textAlign = 'left';
            u.ctx.textBaseline = 'bottom';
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
    let custom = xField.config.custom;
    let scaleDistr: ScaleDistributionConfig = { ...custom?.scaleDistribution };

    builder.addScale({
      scaleKey: xScaleKey,
      orientation: isHorizontal ? ScaleOrientation.Horizontal : ScaleOrientation.Vertical,
      direction: isHorizontal ? ScaleDirection.Right : ScaleDirection.Up,
      distribution: scaleDistr?.type,
      log: scaleDistr?.log,
      linearThreshold: scaleDistr?.linearThreshold,
      min: xField.config.min,
      max: xField.config.max,
      softMin: custom?.axisSoftMin,
      softMax: custom?.axisSoftMax,
      centeredZero: custom?.axisCenteredZero,
      decimals: xField.config.decimals,
      padMinBy: 0,
      padMaxBy: 0,
    });

    builder.addAxis({
      scaleKey: xScaleKey,
      placement: xFieldAxisPlacement,
      show: xFieldAxisShow,
      label: custom?.axisLabel,
      theme,
      grid: { show: custom?.axisGridShow },
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
          orientation: isHorizontal ? ScaleOrientation.Vertical : ScaleOrientation.Horizontal,
          direction: isHorizontal ? ScaleDirection.Up : ScaleDirection.Right,
          distribution: customConfig.scaleDistribution?.type,
          log: customConfig.scaleDistribution?.log,
          linearThreshold: customConfig.scaleDistribution?.linearThreshold,
          min: field.config.min,
          max: field.config.max,
          softMin: customConfig.axisSoftMin,
          softMax: customConfig.axisSoftMax,
          centeredZero: customConfig.axisCenteredZero,
          stackingMode: customConfig.stacking?.mode,
          range:
            field.type === FieldType.enum
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
            placement: isHorizontal ? (customConfig.axisPlacement ?? AxisPlacement.Auto) : AxisPlacement.Bottom,
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

    if (customConfig.spanNulls !== true && showPoints === VisibilityMode.Auto) {
      pointsFilter = (u, seriesIdx, show, gaps) => {
        let filtered = [];

        if (!show) {
          const yData = u.data[seriesIdx];

          if (gaps && gaps.length) {
            const firstIdx = u.posToIdx(gaps[0][0], true);

            if (yData[firstIdx - 1] == null) {
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

            const lastIdx = u.posToIdx(gaps[gaps.length - 1][1], true);

            if (yData[lastIdx + 1] == null) {
              filtered.push(lastIdx);
            }
          }
          // single point
          else {
            // scan right
            let leftIdx = 0;
            while (yData[leftIdx] === null) {
              leftIdx++;
            }

            // scan left
            let rightIdx = yData.length - 1;
            while (rightIdx >= leftIdx && yData[rightIdx] === null) {
              rightIdx--;
            }

            // render if same
            if (leftIdx === rightIdx) {
              filtered.push(leftIdx);
            }
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
      showValues: customConfig.showValues,
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

  const mightShowValues = frame.fields.some((field, i) => {
    if (i === 0) {
      return false;
    }

    const customConfig = field.config.custom ?? {};

    return (
      customConfig.showValues &&
      (customConfig.drawStyle === GraphDrawStyle.Points || customConfig.showPoints !== VisibilityMode.Never)
    );
  });

  if (mightShowValues) {
    // since bars style doesnt show points in Auto mode, we can't piggyback on series.points.show()
    // so we make a simple density-based callback to use here
    const barsShowValues = (u: uPlot) => {
      let width = u.bbox.width / uPlot.pxRatio;
      let count = u.data[0].length;

      // render values when each has at least 30px of width available
      return width / count >= 30;
    };

    builder.addHook('draw', (u: uPlot) => {
      const baseFontSize = 12;
      const font = `${baseFontSize * uPlot.pxRatio}px ${theme.typography.fontFamily}`;

      const { ctx } = u;

      ctx.save();
      ctx.fillStyle = theme.colors.text.primary;
      ctx.font = font;
      ctx.textAlign = 'center';

      for (let seriesIdx = 1; seriesIdx < u.data.length; seriesIdx++) {
        const series = u.series[seriesIdx];
        const field = frame.fields[seriesIdx];

        if (
          field.config.custom?.showValues &&
          // @ts-ignore points.show() is always callable on the instance (but may be boolean when passed to uPlot as init option)
          (series.points?.show?.(u, seriesIdx) ||
            (field.config.custom?.drawStyle === DrawStyle.Bars && barsShowValues(u)))
        ) {
          const xData = u.data[0];
          const yData = u.data[seriesIdx];
          const yScale = series.scale!;

          for (let dataIdx = 0; dataIdx < yData.length; dataIdx++) {
            const yVal = yData[dataIdx];

            if (yVal != null) {
              const text = formattedValueToString(field.display!(yVal));

              const isNegative = yVal < 0;
              const textOffset = isNegative ? 15 : -5;
              ctx.textBaseline = isNegative ? 'top' : 'bottom';

              const xVal = xData[dataIdx];
              const x = u.valToPos(xVal, 'x', true);
              const y = u.valToPos(yVal, yScale, true);

              ctx.fillText(text, x, y + textOffset);
            }
          }
        }
      }

      ctx.restore();
    });
  }

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

  // if hovered value is null, how far we may scan left/right to hover nearest non-null
  const DEFAULT_HOVER_NULL_PROXIMITY = 15;
  const DEFAULT_FOCUS_PROXIMITY = 30;

  let cursor: Partial<uPlot.Cursor> = {
    // horizontal proximity / point hover behavior
    hover: {
      prox: (self, seriesIdx, hoveredIdx) => {
        if (hoverProximity != null) {
          return hoverProximity;
        }

        // when hovering null values, scan data left/right up to 15px
        const yVal = self.data[seriesIdx][hoveredIdx];
        if (yVal === null) {
          return DEFAULT_HOVER_NULL_PROXIMITY;
        }

        // no proximity limit
        return null;
      },
      skip: [null],
    },
    // vertical proximity / series focus behavior
    focus: {
      prox: hoverProximity ?? DEFAULT_FOCUS_PROXIMITY,
    },
    points: { one: true },
  };

  builder.setCursor(cursor);

  return builder;
};

function getNamesToFieldIndex(frame: DataFrame, allFrames: DataFrame[]): Map<string, number> {
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
