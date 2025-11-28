import { Range } from 'uplot';

import {
  applyNullInsertThreshold,
  DataFrame,
  Field,
  FieldConfig,
  FieldSparkline,
  FieldType,
  getFieldColorModeForField,
  GrafanaTheme2,
  isLikelyAscendingVector,
  nullToValue,
  sortDataFrame,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  AxisPlacement,
  GraphDrawStyle,
  GraphFieldConfig,
  VisibilityMode,
  ScaleDirection,
  ScaleOrientation,
} from '@grafana/schema';

import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';

/** @internal
 * Given a sparkline config returns a DataFrame ready to be turned into Plot data set
 **/
export function preparePlotFrame(sparkline: FieldSparkline, config?: FieldConfig<GraphFieldConfig>): DataFrame {
  const length = sparkline.y.values.length;
  const yFieldConfig = {
    ...sparkline.y.config,
    ...config,
  };

  const xField = sparkline.x ?? {
    name: '',
    values: [...Array(length).keys()],
    type: FieldType.number,
    config: {},
  };

  let frame: DataFrame = {
    refId: 'sparkline',
    fields: [
      xField,
      {
        ...sparkline.y,
        config: yFieldConfig,
      },
    ],
    length,
  };

  if (!isLikelyAscendingVector(xField.values)) {
    frame = sortDataFrame(frame, 0);
  }

  return applyNullInsertThreshold({
    frame,
    refFieldPseudoMin: sparkline.timeRange?.from.valueOf(),
    refFieldPseudoMax: sparkline.timeRange?.to.valueOf(),
  });
}

/**
 * apply configuration defaults and ensure that the range is never two equal values.
 */
export function getYRange(field: Field, alignedFrame: DataFrame): Range.MinMax {
  let { min, max } = alignedFrame.fields[1].state?.range!;

  // enure that the min/max from the field config are respected
  min = Math.max(min!, field.config.min ?? -Infinity);
  max = Math.min(max!, field.config.max ?? Infinity);

  // if noValue is set, ensure that it is included in the range as well
  const noValue = +alignedFrame.fields[1].config?.noValue!;
  if (!Number.isNaN(noValue)) {
    min = Math.min(min, noValue);
    max = Math.max(max, noValue);
  }

  // if min and max are equal after all of that, create a range
  // that allows the sparkline to be visible in the center of the viz
  if (min === max) {
    if (min === 0) {
      max = 100;
    } else if (min < 0) {
      max = 0;
      min *= 2;
    } else {
      min = 0;
      max *= 2;
    }
  }

  return [min, max];
}

// TODO: #112977 enable highlight index
// const HIGHLIGHT_IDX_POINT_SIZE = 6;

const defaultConfig: GraphFieldConfig = {
  drawStyle: GraphDrawStyle.Line,
  showPoints: VisibilityMode.Auto,
  axisPlacement: AxisPlacement.Hidden,
  pointSize: 2,
};

export const prepareSeries = (
  sparkline: FieldSparkline,
  fieldConfig?: FieldConfig<GraphFieldConfig>
): { frame: DataFrame; warning?: string } => {
  const frame = nullToValue(preparePlotFrame(sparkline, fieldConfig));
  if (frame.fields.some((f) => f.values.length <= 1)) {
    return {
      warning: t(
        'grafana-ui.components.sparkline.warning.too-few-values',
        'Sparkline requires at least two values to render.'
      ),
      frame,
    };
  }
  return { frame };
};

export const prepareConfig = (
  sparkline: FieldSparkline,
  dataFrame: DataFrame,
  theme: GrafanaTheme2
): UPlotConfigBuilder => {
  const builder = new UPlotConfigBuilder();
  // const rangePad = HIGHLIGHT_IDX_POINT_SIZE / 2;

  builder.setCursor({
    show: false,
    x: false, // no crosshairs
    y: false,
  });

  // X is the first field in the aligned frame
  const xField = dataFrame.fields[0];
  builder.addScale({
    scaleKey: 'x',
    orientation: ScaleOrientation.Horizontal,
    direction: ScaleDirection.Right,
    isTime: false, // xField.type === FieldType.time,
    range: () => {
      if (sparkline.x) {
        if (sparkline.timeRange && sparkline.x.type === FieldType.time) {
          return [sparkline.timeRange.from.valueOf(), sparkline.timeRange.to.valueOf()];
        }
        const vals = sparkline.x.values;
        return [vals[0], vals[vals.length - 1]];
      }
      return [0, sparkline.y.values.length - 1];
    },
  });

  builder.addAxis({
    scaleKey: 'x',
    theme,
    placement: AxisPlacement.Hidden,
  });

  for (let i = 0; i < dataFrame.fields.length; i++) {
    const field = dataFrame.fields[i];
    const config: FieldConfig<GraphFieldConfig> = field.config;
    const customConfig: GraphFieldConfig = {
      ...defaultConfig,
      ...config.custom,
    };

    if (field === xField || field.type !== FieldType.number) {
      continue;
    }

    const scaleKey = config.unit || '__fixed';
    builder.addScale({
      scaleKey,
      orientation: ScaleOrientation.Vertical,
      direction: ScaleDirection.Up,
      range: () => getYRange(field, dataFrame),
    });

    builder.addAxis({
      scaleKey,
      theme,
      placement: AxisPlacement.Hidden,
    });

    const colorMode = getFieldColorModeForField(field);
    const seriesColor = colorMode.getCalculator(field, theme)(0, 0);
    // TODO: #112977 enable highlight index and adjust padding accordingly
    // const hasHighlightIndex = typeof sparkline.highlightIndex === 'number';
    // if (hasHighlightIndex) {
    //   builder.setPadding([rangePad, rangePad, rangePad, rangePad]);
    // }
    const pointsMode =
      customConfig.drawStyle === GraphDrawStyle.Points // || hasHighlightIndex
        ? VisibilityMode.Always
        : customConfig.showPoints;

    builder.addSeries({
      pxAlign: false,
      scaleKey,
      theme,
      colorMode,
      thresholds: config.thresholds,
      drawStyle: customConfig.drawStyle!,
      lineColor: customConfig.lineColor ?? seriesColor,
      lineWidth: customConfig.lineWidth,
      lineInterpolation: customConfig.lineInterpolation,
      showPoints: pointsMode,
      // TODO: #112977 enable highlight index
      pointSize: /* hasHighlightIndex ? HIGHLIGHT_IDX_POINT_SIZE : */ customConfig.pointSize,
      // pointsFilter: hasHighlightIndex ? [sparkline.highlightIndex!] : undefined,
      fillOpacity: customConfig.fillOpacity,
      fillColor: customConfig.fillColor,
      lineStyle: customConfig.lineStyle,
      gradientMode: customConfig.gradientMode,
      spanNulls: customConfig.spanNulls,
    });
  }

  return builder;
};
