import { css } from '@emotion/css';

import { DisplayValue, DisplayValueAlignmentFactors, formattedValueToString, GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { calculateFontSize } from '../../utils/measureText';

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
  alignmentFactors?: DisplayValueAlignmentFactors;
  valueManualFontSize?: number;
  nameManualFontSize?: number;
}

export function RadialText({
  displayValue,
  theme,
  dimensions,
  textMode,
  vizCount,
  shape,
  alignmentFactors,
  valueManualFontSize,
  nameManualFontSize,
}: RadialTextProps) {
  const styles = useStyles2(getStyles);
  const { centerX, centerY, radius, barWidth } = dimensions;

  if (textMode === 'none') {
    return null;
  }

  if (textMode === 'auto') {
    textMode = vizCount === 1 ? 'value' : 'value_and_name';
  }

  const nameToAlignTo = (alignmentFactors ? alignmentFactors.title : displayValue.title) ?? '';
  const valueToAlignTo = formattedValueToString(alignmentFactors ? alignmentFactors : displayValue);

  const showValue = textMode === 'value' || textMode === 'value_and_name';
  const showName = textMode === 'name' || textMode === 'value_and_name';
  const maxTextWidth = radius * 2 - barWidth - radius / 7;

  // Not sure where this comes from but svg text is not using body line-height
  const lineHeight = 1.21;
  const valueWidthToRadiusFactor = 0.6;
  const nameToHeightFactor = 0.3;
  const largeRadiusScalingDecay = 0.92;

  // This pow 0.92 factor is to create a decay so the font size does not become rediculously large for very large panels
  let maxValueHeight = valueWidthToRadiusFactor * Math.pow(radius, largeRadiusScalingDecay);
  let maxNameHeight = radius / 4;

  if (showValue && showName) {
    maxValueHeight = valueWidthToRadiusFactor * Math.pow(radius, largeRadiusScalingDecay);
    maxNameHeight = nameToHeightFactor * Math.pow(radius, largeRadiusScalingDecay);
  }

  const valueFontSize =
    valueManualFontSize ??
    calculateFontSize(
      valueToAlignTo,
      maxTextWidth,
      maxValueHeight,
      lineHeight,
      undefined,
      theme.typography.body.fontWeight
    );

  const nameFontSize =
    nameManualFontSize ??
    calculateFontSize(
      nameToAlignTo,
      maxTextWidth,
      maxNameHeight,
      lineHeight,
      undefined,
      theme.typography.body.fontWeight
    );

  const unitFontSize = Math.max(valueFontSize * 0.7, 5);
  const valueHeight = valueFontSize * lineHeight;
  const nameHeight = nameFontSize * lineHeight;

  const valueY = showName ? centerY - nameHeight / 2 : centerY;
  const nameY = showValue ? valueY + valueHeight * 0.7 : centerY;
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
