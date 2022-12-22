import {
  DisplayValue,
  FALLBACK_COLOR,
  FieldColorModeId,
  FieldConfig,
  GAUGE_DEFAULT_MAXIMUM,
  GAUGE_DEFAULT_MINIMUM,
  getActiveThreshold,
  GrafanaTheme,
  GrafanaTheme2,
  Threshold,
  ThresholdsConfig,
  ThresholdsMode,
} from '@grafana/data';

interface GaugeAutoProps {
  titleFontSize: number;
  gaugeHeight: number;
  showLabel: boolean;
}

export const DEFAULT_THRESHOLDS: ThresholdsConfig = {
  mode: ThresholdsMode.Absolute,
  steps: [
    { value: -Infinity, color: 'green' },
    { value: 80, color: 'red' },
  ],
};

export function calculateGaugeAutoProps(width: number, height: number, title: string | undefined): GaugeAutoProps {
  const showLabel = title !== null && title !== undefined;
  const titleFontSize = Math.min((width * 0.15) / 1.5, 20); // 20% of height * line-height, max 40px
  const titleHeight = titleFontSize * 1.5;
  const availableHeight = showLabel ? height - titleHeight : height;
  const gaugeHeight = Math.min(availableHeight, width);

  return {
    showLabel,
    gaugeHeight,
    titleFontSize,
  };
}

export function getFormattedThresholds(
  decimals: number,
  field: FieldConfig,
  value: DisplayValue,
  theme: GrafanaTheme | GrafanaTheme2
): Threshold[] {
  if (field.color?.mode !== FieldColorModeId.Thresholds) {
    return [{ value: field.min ?? GAUGE_DEFAULT_MINIMUM, color: value.color ?? FALLBACK_COLOR }];
  }

  const thresholds = field.thresholds ?? DEFAULT_THRESHOLDS;
  const isPercent = thresholds.mode === ThresholdsMode.Percentage;
  const steps = thresholds.steps;

  let min = field.min ?? GAUGE_DEFAULT_MINIMUM;
  let max = field.max ?? GAUGE_DEFAULT_MAXIMUM;

  if (isPercent) {
    min = 0;
    max = 100;
  }

  const first = getActiveThreshold(min, steps);
  const last = getActiveThreshold(max, steps);
  const formatted: Threshold[] = [
    { value: +min.toFixed(decimals), color: theme.visualization.getColorByName(first.color) },
  ];
  let skip = true;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (skip) {
      if (first === step) {
        skip = false;
      }
      continue;
    }
    const prev = steps[i - 1];
    formatted.push({ value: step.value, color: theme.visualization.getColorByName(prev.color) });
    if (step === last) {
      break;
    }
  }
  formatted.push({ value: +max.toFixed(decimals), color: theme.visualization.getColorByName(last.color) });
  return formatted;
}
