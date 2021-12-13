import { useFocusRing } from '@react-aria/focus';
import React, { CSSProperties } from 'react';
import tinycolor from 'tinycolor2';
import { useTheme2 } from '../../themes/ThemeContext';
import { selectors } from '@grafana/e2e-selectors';

/** @internal */
export enum ColorSwatchVariant {
  Small = 'small',
  Large = 'large',
}

/** @internal */
export interface Props extends React.HTMLAttributes<HTMLDivElement> {
  color: string;
  label?: string;
  variant?: ColorSwatchVariant;
  isSelected?: boolean;
}

/** @internal */
export const ColorSwatch = React.forwardRef<HTMLDivElement, Props>(
  ({ color, label, variant = ColorSwatchVariant.Small, isSelected, 'aria-label': ariaLabel, ...otherProps }, ref) => {
    const theme = useTheme2();

    const { isFocusVisible, focusProps } = useFocusRing();
    const tc = tinycolor(color);
    const isSmall = variant === ColorSwatchVariant.Small;
    const hasLabel = !!label;
    const swatchSize = isSmall ? '16px' : '32px';

    const swatchStyles: CSSProperties = {
      width: swatchSize,
      height: swatchSize,
      border: 'none',
      borderRadius: '50%',
      background: `${color}`,
      marginLeft: hasLabel ? '8px' : '0px',
      marginRight: isSmall ? '0px' : '6px',
      outline: isFocusVisible ? `2px solid  ${theme.colors.primary.main}` : 'none',
      outlineOffset: '1px',
      transition: 'none',
      boxShadow: isSelected
        ? `inset 0 0 0 2px ${color}, inset 0 0 0 4px ${theme.colors.getContrastText(color)}`
        : 'none',
    };

    if (tc.getAlpha() < 0.1) {
      swatchStyles.border = `2px solid ${theme.colors.border.medium}`;
    }

    const colorLabel = `${ariaLabel || label} color`;

    return (
      <div
        ref={ref}
        style={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
        }}
        data-testid={selectors.components.ColorSwatch.name}
        {...otherProps}
      >
        {hasLabel && <span>{label}</span>}
        <button style={swatchStyles} {...focusProps} aria-label={colorLabel} />
      </div>
    );
  }
);

ColorSwatch.displayName = 'ColorSwatch';
