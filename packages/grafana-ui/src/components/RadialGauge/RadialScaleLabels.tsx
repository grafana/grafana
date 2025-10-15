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
  angleRange,
}: RadialScaleLabelsProps) {
  const { centerX, centerY, scaleLabelsFontSize, scaleLabelsRadius } = dimensions;

  const fieldConfig = fieldDisplay.field;
  const min = fieldConfig.min ?? 0;
  const max = fieldConfig.max ?? 100;

  const fontSize = scaleLabelsFontSize;
  const textLineHeight = scaleLabelsFontSize * 1.2;
  const radius = scaleLabelsRadius - textLineHeight;

  function getTextPosition(text: string, value: number) {
    const valueDeg = ((value - min) / (max - min)) * angleRange;
    const measure = measureText(text, fontSize, theme.typography.fontWeightMedium);
    const textWidthAngle = (measure.width / (2 * Math.PI * radius)) * angleRange;
    const finalAngle = startAngle + valueDeg - textWidthAngle;

    const position = toCartesian(centerX, centerY, radius, finalAngle);

    return { ...position, transform: `rotate(${finalAngle}, ${position.x}, ${position.y})` };
  }

  return (
    <g>
      {thresholds.map((threshold, index) => {
        const labelPos = getTextPosition(String(threshold.value), threshold.value);

        return (
          <text
            key={index}
            x={labelPos.x}
            y={labelPos.y}
            fontSize={fontSize}
            fill={theme.colors.text.primary}
            transform={labelPos.transform}
          >
            {threshold.value}
          </text>
        );
      })}
    </g>
  );
}
