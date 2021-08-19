import React, { CSSProperties } from 'react';
import tinycolor from 'tinycolor2';
import { useTheme2 } from '../../themes/ThemeContext';

/** @internal */
export enum ColorSwatchVariant {
  Small = 'small',
  Large = 'large',
}

/** @internal */
export interface Props extends React.DOMAttributes<HTMLDivElement> {
  color: string;
  label?: string;
  variant?: ColorSwatchVariant;
  isSelected?: boolean;
}

/** @internal */
export const ColorSwatch = React.forwardRef<HTMLDivElement, Props>(
  ({ color, label, variant = ColorSwatchVariant.Small, isSelected, ...otherProps }, ref) => {
    const theme = useTheme2();
    const tc = tinycolor(color);
    const isSmall = variant === ColorSwatchVariant.Small;
    const hasLabel = !!label;
    const swatchSize = isSmall ? '16px' : '32px';

    const swatchStyles: CSSProperties = {
      width: swatchSize,
      height: swatchSize,
      borderRadius: '50%',
      background: `${color}`,
      marginRight: hasLabel ? '8px' : '0px',
      boxShadow: isSelected
        ? `inset 0 0 0 2px ${color}, inset 0 0 0 4px ${theme.colors.getContrastText(color)}`
        : 'none',
    };

    if (tc.getAlpha() < 0.1) {
      swatchStyles.border = `2px solid ${theme.colors.border.medium}`;
    }

    return (
      <div
        ref={ref}
        style={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
        }}
        {...otherProps}
      >
        <div style={swatchStyles} />
        {hasLabel && <span>{label}</span>}
      </div>
    );
  }
);

ColorSwatch.displayName = 'ColorSwatch';
