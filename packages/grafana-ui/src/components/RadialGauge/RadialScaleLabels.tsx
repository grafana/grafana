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
  const { centerX, centerY, radius, barWidth } = dimensions;

  const fieldConfig = fieldDisplay.field;
  const min = fieldConfig.min ?? 0;
  const max = fieldConfig.max ?? 100;

  const minPos = toCartesian(centerX, centerY, radius - barWidth / 2 + 40, startAngle);
  const maxPos = toCartesian(centerX, centerY, radius - barWidth / 2 + 40, endAngle);

  return (
    <g>
      <text
        x={minPos.x}
        y={minPos.y}
        fontSize={'14'}
        fill={theme.colors.text.primary}
        transform={`rotate(${startAngle}, ${minPos.x}, ${minPos.y})`}
      >
        {fieldDisplay.field.min ?? 0}
      </text>
      <text
        x={maxPos.x}
        y={maxPos.y}
        fontSize={'14'}
        fill={theme.colors.text.primary}
        transform={`rotate(${endAngle}, ${maxPos.x}, ${maxPos.y})`}
      >
        {fieldDisplay.field.max ?? 100}
      </text>
      {thresholds.map((threshold, index) => {
        const valueDeg = ((threshold.value - min) / (max - min)) * angleRange;
        const thresholdLabelPos = toCartesian(centerX, centerY, radius - barWidth / 2 + 40, startAngle + valueDeg);

        return (
          <text
            key={index}
            x={thresholdLabelPos.x}
            y={thresholdLabelPos.y}
            fontSize={'14'}
            fill={theme.colors.text.primary}
            transform={`rotate(${startAngle + valueDeg}, ${thresholdLabelPos.x}, ${thresholdLabelPos.y})`}
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
