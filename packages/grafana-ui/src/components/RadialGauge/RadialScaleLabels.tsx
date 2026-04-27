import { memo, useId } from 'react';

import type { FieldDisplay } from '@grafana/data/field';
import type { GrafanaTheme2 } from '@grafana/data/themes';
import { type Threshold, ThresholdsMode } from '@grafana/data/types';
import { t } from '@grafana/i18n';

import { measureText } from '../../utils/measureText';

import { type RadialGaugeDimensions } from './types';
import { getFieldConfigMinMax, drawRadialArcPath } from './utils';

interface RadialScaleLabelsProps {
  fieldDisplay: FieldDisplay;
  theme: GrafanaTheme2;
  thresholds: Threshold[];
  thresholdsMode: ThresholdsMode;
  dimensions: RadialGaugeDimensions;
  startAngle: number;
  angleRange: number;
  neutral?: number;
}

interface RadialScaleLabel {
  value: number;
  labelValue?: string;
  startOffset: number;
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
    angleRange,
    neutral: rawNeutral,
  }: RadialScaleLabelsProps) => {
    const pathId = useId();

    const { centerX, centerY, scaleLabelsFontSize, scaleLabelsRadius, barWidth } = dimensions;
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
    const labelsPath = drawRadialArcPath(startAngle, angleRange, radius, centerX, centerY);
    const pathLength = (angleRange / 360) * 2 * Math.PI * radius;

    const isFullCircle = angleRange >= 360;

    const minLabelValue = allValues.reduce((min, value) => Math.min(value, min), allValues[0]);
    const maxLabelValue = allValues.reduce((max, value) => Math.max(value, max), allValues[0]);

    function getStartOffset(text: string, value: number): number {
      const isLast = value === maxLabelValue;
      const isFirst = value === minLabelValue;

      const fraction = (value - min) / (max - min);
      let offset = fraction * pathLength;

      const measure = measureText(text, fontSize, theme.typography.fontWeightMedium);

      // labels at the beginning and end of the path need to be adjusted to avoid clipping
      if (isFullCircle) {
        // For full circle: nudge labels near the top at the end of the circle
        // counter-clockwise along the path to create extra space at 12 o'clock
        const paddingFactor = 0.65; // needs to be >= 0.5 so that center-to-center gap (2x factor x width) >= label width
        const padding = measure.width * paddingFactor;
        if (isFirst) {
          offset += padding;
        } else if (isLast) {
          offset -= padding;
        }
      } else {
        const halfWidth = measure.width * 0.5;
        // for non-circle, avoid clipping the bottom:
        // keep first label's start at least halfWidth from path start
        if (isFirst && offset - halfWidth < 0) {
          offset += halfWidth;
        }
        // Keep last label's end at least halfWidth before path end
        if (isLast && offset + halfWidth > pathLength) {
          offset -= halfWidth;
        }
      }

      return offset;
    }

    const labels: RadialScaleLabel[] = thresholds.map((threshold) => {
      const resolvedValue = resolvedThresholdValue(threshold.value, thresholdsMode, min, max);
      const labelText = thresholdsMode === ThresholdsMode.Percentage ? `${threshold.value}%` : String(threshold.value);
      return {
        value: resolvedValue,
        labelValue: labelText,
        startOffset: getStartOffset(labelText, resolvedValue),
        label: t(`gauge.threshold`, 'Threshold {{value}}', { value: labelText }),
      };
    });

    if (neutral !== undefined) {
      labels.push({
        value: neutral,
        startOffset: getStartOffset(String(neutral), neutral),
        label: t(`gauge.neutral`, 'Neutral {{value}}', { value: neutral }),
      });
    }

    return (
      <g>
        <defs>
          <path id={pathId} d={labelsPath} fill="none" strokeWidth={barWidth} />
        </defs>
        {labels.map((label) => (
          <text
            key={label.label}
            fontSize={fontSize}
            fill={theme.colors.text.primary}
            textAnchor="middle"
            aria-label={label.label}
          >
            <textPath href={`#${pathId}`} startOffset={label.startOffset}>
              {label.labelValue ?? label.value}
            </textPath>
          </text>
        ))}
      </g>
    );
  }
);

RadialScaleLabels.displayName = 'RadialScaleLabels';
