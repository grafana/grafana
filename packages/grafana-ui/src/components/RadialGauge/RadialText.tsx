import { css } from '@emotion/css';
import { memo } from 'react';

import {
  type DisplayValue,
  type DisplayValueAlignmentFactors,
  type FieldSparkline,
  formattedValueToString,
  type GrafanaTheme2,
} from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { calculateFontSize } from '../../utils/measureText';
import { TruncatedText } from '../Text/TruncatedText';

import { type RadialShape, type RadialTextMode, type RadialGaugeDimensions } from './types';

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
const MIN_VALUE_FONT_SIZE = 1;
const MIN_NAME_FONT_SIZE = 10;
const MIN_UNIT_FONT_SIZE = 6;
const NAME_ARC_GAP = 1;

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

    const valueFontSize = Math.max(
      valueManualFontSize ??
        calculateFontSize(
          valueToAlignTo,
          maxTextWidth,
          maxValueHeight,
          LINE_HEIGHT_FACTOR,
          undefined,
          theme.typography.body.fontWeight
        ),
      MIN_VALUE_FONT_SIZE
    );

    const nameFontSize = Math.max(
      nameManualFontSize ??
        calculateFontSize(
          nameToAlignTo,
          maxTextWidth,
          maxNameHeight,
          LINE_HEIGHT_FACTOR,
          undefined,
          theme.typography.body.fontWeight
        ),
      MIN_NAME_FONT_SIZE
    );

    const unitFontSize = Math.max(valueFontSize * VALUE_SPACE_PERCENTAGE, MIN_UNIT_FONT_SIZE);
    const valueHeight = valueFontSize * LINE_HEIGHT_FACTOR;
    const nameHeight = nameFontSize * LINE_HEIGHT_FACTOR;

    const valueY = showName ? centerY - nameHeight * (1 - VALUE_SPACE_PERCENTAGE) : centerY;
    const nameY = showValue ? valueY + valueHeight * VALUE_SPACE_PERCENTAGE : centerY;
    const nameColor = showValue ? theme.colors.text.secondary : theme.colors.text.primary;

    // adjust the text up on gauges and when sparklines are present
    let yOffset = 0;
    if (shape === 'gauge') {
      // we render from the center of the gauge, so move up by half of half of the total height
      yOffset += (valueHeight + nameHeight) / 4;
    }
    if (sparkline) {
      yOffset += SPARKLINE_SPACING;
    }

    // The name can use the whole width inside the arc at its height. maxTextWidth is too narrow for this,
    // because the browser adds letter spacing that calculateFontSize does not measure.
    const nameCenterY = nameY - yOffset;
    const nameRadius = radius - barWidth / 2 - NAME_ARC_GAP;
    const nameWidth = 2 * Math.sqrt(Math.max(nameRadius ** 2 - (nameCenterY - centerY) ** 2, 0));

    return (
      <g>
        {showValue && (
          <text
            x={centerX}
            y={valueY - yOffset}
            fontSize={valueFontSize}
            fill={theme.colors.text.primary}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            <tspan fontSize={unitFontSize}>{displayValue.prefix ?? ''}</tspan>
            <tspan>{displayValue.text}</tspan>
            <tspan fontSize={unitFontSize}>{displayValue.suffix ?? ''}</tspan>
          </text>
        )}
        {showName && (
          <foreignObject
            x={centerX - nameWidth / 2}
            y={nameCenterY - nameHeight / 2}
            width={nameWidth}
            height={nameHeight}
          >
            <TruncatedText
              childElement={(ref) => (
                <span ref={ref} className={styles.name} style={{ fontSize: nameFontSize, color: nameColor }}>
                  {displayValue.title}
                </span>
              )}
            />
          </foreignObject>
        )}
      </g>
    );
  }
);

RadialText.displayName = 'RadialText';

const getStyles = () => ({
  name: css({
    display: 'block',
    lineHeight: LINE_HEIGHT_FACTOR,
    textAlign: 'center',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  }),
});
