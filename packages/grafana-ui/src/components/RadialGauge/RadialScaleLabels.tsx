import { memo } from 'react';

import { FieldDisplay, GrafanaTheme2, Threshold, ThresholdsMode } from '@grafana/data';
import { t } from '@grafana/i18n';

import { measureText } from '../../utils/measureText';

import { RadialGaugeDimensions } from './types';
import { getFieldConfigMinMax, toCartesian } from './utils';

interface RadialScaleLabelsProps {
  fieldDisplay: FieldDisplay;
  theme: GrafanaTheme2;
  thresholds: Threshold[];
  thresholdsMode: ThresholdsMode;
  dimensions: RadialGaugeDimensions;
  startAngle: number;
  endAngle: number;
  angleRange: number;
  neutral?: number;
}

interface RadialScaleLabel {
  value: number;
  labelValue?: string;
  pos: { x: number; y: number; transform: string };
  label: string;
}

const LINE_HEIGHT_FACTOR = 1.2;

const resolvedThresholdValue = (value: number, mode: ThresholdsMode, min: number, max: number) => {
  return mode === ThresholdsMode.Percentage ? (value / 100) * (max - min) + min : value;
};

export const RadialScaleLabels = memo(
  ({
    fieldDisplay,
    thresholds: rawThresholds,
    thresholdsMode,
    theme,
    dimensions,
    startAngle,
    endAngle,
    angleRange,
    neutral: rawNeutral,
  }: RadialScaleLabelsProps) => {
    const { centerX, centerY, scaleLabelsFontSize, scaleLabelsRadius } = dimensions;
    const [min, max] = getFieldConfigMinMax(fieldDisplay);
    const thresholds = rawThresholds.filter(
      (threshold) =>
        resolvedThresholdValue(threshold.value, thresholdsMode, min, max) >= min &&
        resolvedThresholdValue(threshold.value, thresholdsMode, min, max) <= max
    );
    const allValues = thresholds.map((t) => resolvedThresholdValue(t.value, thresholdsMode, min, max));

    // there are a couple cases where we will not show the neutral label even if neutral is set.
    // 1. if neutral is not between min and max
    // 2. if neutral duplicates a threshold value, showing it twice is pointless and messy
    let neutral: number | undefined;
    if (rawNeutral !== undefined && rawNeutral >= min && rawNeutral <= max && !allValues.includes(rawNeutral)) {
      neutral = rawNeutral;
      allValues.push(neutral);
    }

    const fontSize = scaleLabelsFontSize;
    const textLineHeight = scaleLabelsFontSize * LINE_HEIGHT_FACTOR;
    const radius = scaleLabelsRadius - textLineHeight;

    const minLabelValue = allValues.reduce((min, value) => Math.min(value, min), allValues[0]);
    const maxLabelValue = allValues.reduce((max, value) => Math.max(value, max), allValues[0]);

    function getTextPosition(text: string, value: number) {
      const isLast = value === maxLabelValue;
      const isFirst = value === minLabelValue;

      let valueDeg = ((value - min) / (max - min)) * angleRange;
      let finalAngle = startAngle + valueDeg;

      // Now adjust the final angle based on the label text width and the labels position on the arc
      let measure = measureText(text, fontSize, theme.typography.fontWeightMedium);
      let textWidthAngle = (measure.width / (2 * Math.PI * radius)) * angleRange;

      // the centering is different for gauge or circle shapes for some reason
      finalAngle -= endAngle < 180 ? textWidthAngle : textWidthAngle / 2;

      // For circle gauges we need to shift the first label more
      if (isFirst) {
        finalAngle += textWidthAngle;
      }

      // For circle gauges we need to shift the last label more
      if (isLast && endAngle === 360) {
        finalAngle -= textWidthAngle;
      }

      const position = toCartesian(centerX, centerY, radius, finalAngle);

      return { ...position, transform: `rotate(${finalAngle}, ${position.x}, ${position.y})` };
    }

    const labels: RadialScaleLabel[] = thresholds.map((threshold) => {
      const resolvedValue = resolvedThresholdValue(threshold.value, thresholdsMode, min, max);
      const labelText = thresholdsMode === ThresholdsMode.Percentage ? `${threshold.value}%` : String(threshold.value);
      return {
        value: resolvedValue,
        labelValue: labelText,
        pos: getTextPosition(labelText, resolvedValue),
        label: t(`gauge.threshold`, 'Threshold {{value}}', { value: labelText }),
      };
    });

    if (neutral !== undefined) {
      labels.push({
        value: neutral,
        pos: getTextPosition(String(neutral), neutral),
        label: t(`gauge.neutral`, 'Neutral {{value}}', { value: neutral }),
      });
    }

    return (
      <g>
        {labels.map((label) => (
          <text
            key={label.label}
            x={label.pos.x}
            y={label.pos.y}
            fontSize={fontSize}
            fill={theme.colors.text.primary}
            transform={label.pos.transform}
            aria-label={label.label}
          >
            {label.labelValue ?? label.value}
          </text>
        ))}
      </g>
    );
  }
);

RadialScaleLabels.displayName = 'RadialScaleLabels';
