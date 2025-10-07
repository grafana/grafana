import { css } from '@emotion/css';

import { DisplayValue, GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';

import { RadialShape, RadialTextMode } from './RadialGauge';
import { GaugeDimensions } from './utils';

// function toCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
//   let radian = ((angleInDegrees - 90) * Math.PI) / 180.0;
//   return {
//     x: centerX + radius * Math.cos(radian),
//     y: centerY + radius * Math.sin(radian),
//   };
// }

interface RadialTextProps {
  displayValue: DisplayValue;
  theme: GrafanaTheme2;
  dimensions: GaugeDimensions;
  textMode: RadialTextMode;
  vizCount: number;
  shape: RadialShape;
}

export function RadialText({ displayValue, theme, dimensions, textMode, vizCount, shape }: RadialTextProps) {
  const styles = useStyles2(getStyles);
  const { centerX, centerY, radius } = dimensions;

  if (textMode === 'none') {
    return null;
  }

  if (textMode === 'auto') {
    textMode = vizCount === 1 ? 'value' : 'value_and_name';
  }

  const showValue = textMode === 'value' || textMode === 'value_and_name';
  const showName = textMode === 'name' || textMode === 'value_and_name';

  const valueFontSize = Math.max(radius / 3.5, 12);
  const unitFontSize = Math.max(valueFontSize * 0.7, 12);
  const nameFontSize = Math.max(valueFontSize * 0.5, 12);

  const valueHeight = valueFontSize * 1.2;
  const nameHeight = nameFontSize * 1.2;

  const valueY = showName ? centerY - nameHeight / 2 : centerY;
  const nameY = showValue ? valueY + valueHeight * 0.85 : centerY;
  const nameColor = showValue ? theme.colors.text.secondary : theme.colors.text.primary;
  const suffixShift = (valueFontSize - unitFontSize * 1.2) / 2;

  // For gauge shape we shift text up a bit
  const valueDy = shape === 'gauge' ? -valueFontSize * 0.3 : 0;
  const nameDy = shape === 'gauge' ? -nameFontSize * 0.7 : 0;

  return (
    <g>
      {showValue && (
        <text
          x={centerX}
          y={valueY}
          fontSize={valueFontSize}
          fill={theme.colors.text.primary}
          className={styles.text}
          textAnchor="middle"
          dominantBaseline="middle"
          dy={valueDy}
        >
          <tspan fontSize={unitFontSize}>{displayValue.prefix ?? ''}</tspan>
          <tspan>{displayValue.text}</tspan>
          <tspan className={styles.text} fontSize={unitFontSize} dy={suffixShift}>
            {displayValue.suffix ?? ''}
          </tspan>
        </text>
      )}
      {showName && (
        <text
          fontSize={nameFontSize}
          x={centerX}
          y={nameY}
          dy={nameDy}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={nameColor}
        >
          {displayValue.title}
        </text>
      )}
    </g>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  text: css({
    verticalAlign: 'bottom',
  }),
});
