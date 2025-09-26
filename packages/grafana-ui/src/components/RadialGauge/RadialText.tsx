import { css } from '@emotion/css';

import { DisplayValue, GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';

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
  size: number;
}
export function RadialText({ displayValue, theme, size }: RadialTextProps) {
  const styles = useStyles2(getStyles);

  const centerX = size / 2;
  const centerY = size / 2;
  const height = 25 * theme.typography.body.lineHeight;
  const titleSpacing = 4;
  const titleY = centerY - 25 / 4;
  const valueY = titleY + height / 2 + titleSpacing;

  return (
    <g>
      <text
        x={centerX}
        y={titleY}
        fontSize={'25'}
        fill={theme.colors.text.primary}
        className={styles.text}
        textAnchor="middle"
      >
        {displayValue.prefix ?? ''}
        <tspan>{displayValue.text}</tspan>
        <tspan className={styles.text} fontSize={17}>
          {displayValue.suffix ?? ''}
        </tspan>
      </text>
      <text x={centerX} y={valueY} textAnchor="middle" dominantBaseline="middle" fill={theme.colors.text.secondary}>
        {displayValue.title}
      </text>
    </g>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  text: css({
    verticalAlign: 'bottom',
  }),
});
