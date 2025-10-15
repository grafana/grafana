import { css } from '@emotion/css';

import { FieldDisplay, GrafanaTheme2, Threshold } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';

import { RadialShape } from './RadialGauge';
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
  const styles = useStyles2(getStyles);
  const { centerX, centerY, scaleLabelsFontSize, scaleLabelsRadius } = dimensions;

  const fieldConfig = fieldDisplay.field;
  const min = fieldConfig.min ?? 0;
  const max = fieldConfig.max ?? 100;
  const fontSize = scaleLabelsFontSize;
  const textLineHeight = scaleLabelsFontSize * 1.2;

  function getTextPosition(text: string, value: number) {
    const valueDeg = ((value - min) / (max - min)) * angleRange;
    const finalAngle = startAngle + valueDeg;

    const position = toCartesian(centerX, centerY, scaleLabelsRadius - textLineHeight, finalAngle);

    return { ...position, transform: `rotate(${finalAngle}, ${position.x}, ${position.y})` };
  }

  const minPos = getTextPosition('min', min);
  const maxPos = getTextPosition('max', max);

  return (
    <g>
      <text x={minPos.x} y={minPos.y} fontSize={fontSize} fill={theme.colors.text.primary} transform={minPos.transform}>
        {fieldDisplay.field.min ?? 0}
      </text>
      <text x={maxPos.x} y={maxPos.y} fontSize={fontSize} fill={theme.colors.text.primary} transform={maxPos.transform}>
        {fieldDisplay.field.max ?? 100}
      </text>
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

const getStyles = (theme: GrafanaTheme2) => ({
  text: css({
    verticalAlign: 'bottom',
  }),
});
