import { DisplayValue, GrafanaTheme2 } from '@grafana/data';

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
  const centerX = size / 2;
  const centerY = size / 2;
  const height = 14 * theme.typography.body.lineHeight;
  const titleSpacing = 4;
  const titleY = centerY - height / 2 - titleSpacing;
  const valueY = centerY + height / 2 + titleSpacing;

  return (
    <g>
      <text
        x={centerX}
        y={titleY}
        fontSize={'20'}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={theme.colors.text.primary}
      >
        {displayValue.prefix ?? ''}
        {displayValue.text}
        {displayValue.suffix ?? ''}
      </text>
      <text x={centerX} y={valueY} textAnchor="middle" dominantBaseline="middle" fill={theme.colors.text.secondary}>
        {displayValue.title}
      </text>
    </g>
  );
}
