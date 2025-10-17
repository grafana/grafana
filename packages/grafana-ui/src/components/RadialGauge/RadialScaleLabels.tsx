import { FieldDisplay, GrafanaTheme2, Threshold } from '@grafana/data';

import { measureText } from '../../utils/measureText';

import { GaugeDimensions, toCartesian } from './utils';

interface RadialScaleLabelsProps {
  fieldDisplay: FieldDisplay;
  theme: GrafanaTheme2;
  thresholds: Threshold[];
  dimensions: GaugeDimensions;
  startAngle: number;
  endAngle: number;
  angleRange: number;
}

export function RadialScaleLabels({
  fieldDisplay,
  thresholds,
  theme,
  dimensions,
  startAngle,
  endAngle,
  angleRange,
}: RadialScaleLabelsProps) {
  const { centerX, centerY, scaleLabelsFontSize, scaleLabelsRadius } = dimensions;

  const fieldConfig = fieldDisplay.field;
  const min = fieldConfig.min ?? 0;
  const max = fieldConfig.max ?? 100;

  const fontSize = scaleLabelsFontSize;
  const textLineHeight = scaleLabelsFontSize * 1.2;
  const radius = scaleLabelsRadius - textLineHeight;

  function getTextPosition(text: string, value: number, index: number) {
    const isLast = index === thresholds.length - 1;
    const isFirst = index === 0;

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

  return (
    <g>
      {thresholds.map((threshold, index) => {
        const labelPos = getTextPosition(String(threshold.value), threshold.value, index);

        return (
          <text
            key={index}
            x={labelPos.x}
            y={labelPos.y}
            fontSize={fontSize}
            fill={theme.colors.text.primary}
            transform={labelPos.transform}
            aria-label={`threshold ${threshold.value}`}
          >
            {threshold.value}
          </text>
        );
      })}
    </g>
  );
}
