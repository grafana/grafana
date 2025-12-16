import { css } from '@emotion/css';
import { memo } from 'react';

import {
  DisplayValue,
  DisplayValueAlignmentFactors,
  FieldSparkline,
  formattedValueToString,
  GrafanaTheme2,
} from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { calculateFontSize } from '../../utils/measureText';

import { RadialShape, RadialTextMode, RadialGaugeDimensions } from './types';

interface RadialTextProps {
  displayValue: DisplayValue;
  theme: GrafanaTheme2;
  dimensions: RadialGaugeDimensions;
  textMode: Exclude<RadialTextMode, 'auto'>;
  shape: RadialShape;
  sparkline?: FieldSparkline;
  alignmentFactors?: DisplayValueAlignmentFactors;
  valueManualFontSize?: number;
  nameManualFontSize?: number;
}

const LINE_HEIGHT_FACTOR = 1.21;
const VALUE_WIDTH_TO_RADIUS_FACTOR = 0.82;
const NAME_TO_HEIGHT_FACTOR = 0.45;
const LARGE_RADIUS_SCALING_DECAY = 0.86;
const MAX_TEXT_WIDTH_DIVISOR = 7;
const MAX_NAME_HEIGHT_DIVISOR = 4;
const VALUE_SPACE_PERCENTAGE = 0.7;
const SPARKLINE_SPACING = 8;
const MIN_UNIT_FONT_SIZE = 5;

export const RadialText = memo(
  ({
    displayValue,
    theme,
    dimensions,
    textMode,
    shape,
    sparkline,
    alignmentFactors,
    valueManualFontSize,
    nameManualFontSize,
  }: RadialTextProps) => {
    const styles = useStyles2(getStyles);
    const { centerX, centerY, radius, barWidth } = dimensions;

    if (textMode === 'none') {
      return null;
    }

    const nameToAlignTo = (alignmentFactors ? alignmentFactors.title : displayValue.title) ?? '';
    const valueToAlignTo = formattedValueToString(alignmentFactors ? alignmentFactors : displayValue);

    const showValue = textMode === 'value' || textMode === 'value_and_name';
    const showName = textMode === 'name' || textMode === 'value_and_name';
    const maxTextWidth = radius * 2 - barWidth - radius / MAX_TEXT_WIDTH_DIVISOR;

    // This pow 0.92 factor is to create a decay so the font size does not become rediculously large for very large panels
    let maxValueHeight = VALUE_WIDTH_TO_RADIUS_FACTOR * Math.pow(radius, LARGE_RADIUS_SCALING_DECAY);
    let maxNameHeight = radius / MAX_NAME_HEIGHT_DIVISOR;

    if (showValue && showName) {
      maxValueHeight = VALUE_WIDTH_TO_RADIUS_FACTOR * Math.pow(radius, LARGE_RADIUS_SCALING_DECAY);
      maxNameHeight = NAME_TO_HEIGHT_FACTOR * Math.pow(radius, LARGE_RADIUS_SCALING_DECAY);
    }

    const valueFontSize =
      valueManualFontSize ??
      calculateFontSize(
        valueToAlignTo,
        maxTextWidth,
        maxValueHeight,
        LINE_HEIGHT_FACTOR,
        undefined,
        theme.typography.body.fontWeight
      );

    const nameFontSize =
      nameManualFontSize ??
      calculateFontSize(
        nameToAlignTo,
        maxTextWidth,
        maxNameHeight,
        LINE_HEIGHT_FACTOR,
        undefined,
        theme.typography.body.fontWeight
      );

    const unitFontSize = Math.max(valueFontSize * VALUE_SPACE_PERCENTAGE, MIN_UNIT_FONT_SIZE);
    const valueHeight = valueFontSize * LINE_HEIGHT_FACTOR;
    const nameHeight = nameFontSize * LINE_HEIGHT_FACTOR;

    const valueY = showName ? centerY - nameHeight * (1 - VALUE_SPACE_PERCENTAGE) : centerY;
    const nameY = showValue ? valueY + valueHeight * VALUE_SPACE_PERCENTAGE : centerY;
    const nameColor = showValue ? theme.colors.text.secondary : theme.colors.text.primary;
    const suffixShift = (valueFontSize - unitFontSize * LINE_HEIGHT_FACTOR) / 2;

    // adjust the text up on gauges and when sparklines are present
    let yOffset = 0;
    if (shape === 'gauge') {
      // we render from the center of the gauge, so move up by half of half of the total height
      yOffset -= (valueHeight + nameHeight) / 4;
    }
    if (sparkline) {
      yOffset -= SPARKLINE_SPACING;
    }

    return (
      <g transform={`translate(0, ${yOffset})`}>
        {showValue && (
          <text
            x={centerX}
            y={valueY}
            fontSize={valueFontSize}
            fill={theme.colors.text.primary}
            className={styles.text}
            textAnchor="middle"
            dominantBaseline="middle"
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
);

RadialText.displayName = 'RadialText';

const getStyles = (_theme: GrafanaTheme2) => ({
  text: css({
    verticalAlign: 'bottom',
  }),
});
