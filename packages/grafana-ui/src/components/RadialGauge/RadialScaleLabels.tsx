import { memo } from 'react';

import { FieldDisplay, GrafanaTheme2, Threshold } from '@grafana/data';
import { t } from '@grafana/i18n';

import { measureText } from '../../utils/measureText';

import { RadialGaugeDimensions } from './types';
import { getFieldConfigMinMax, toCartesian } from './utils';

interface RadialScaleLabelsProps {
  fieldDisplay: FieldDisplay;
  theme: GrafanaTheme2;
  thresholds: Threshold[];
  dimensions: RadialGaugeDimensions;
  startAngle: number;
  endAngle: number;
  angleRange: number;
  neutral?: number;
}

const LINE_HEIGHT_FACTOR = 1.2;

export const RadialScaleLabels = memo(
  ({
    fieldDisplay,
    thresholds,
    theme,
    dimensions,
    startAngle,
    endAngle,
    angleRange,
    neutral: rawNeutral,
  }: RadialScaleLabelsProps) => {
    const { centerX, centerY, scaleLabelsFontSize, scaleLabelsRadius } = dimensions;
    const [min, max] = getFieldConfigMinMax(fieldDisplay);
    const allValues = thresholds.map((t) => t.value);

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

    const minLabelValue = allValues.reduce((min, value) => (value < min ? value : min), allValues[0]);
    const maxLabelValue = allValues.reduce((max, value) => (value > max ? value : max), allValues[0]);

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

    const labels = thresholds.map((threshold, index) => ({
      value: threshold.value,
      pos: getTextPosition(String(threshold.value), threshold.value),
      label: t(`gauge.threshold`, 'Threshold {{value}}', { value: threshold.value }),
    }));

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
            {label.value}
          </text>
        ))}
      </g>
    );
  }
);

RadialScaleLabels.displayName = 'RadialScaleLabels';
