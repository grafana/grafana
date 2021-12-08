import { useFocusRing } from '@react-aria/focus';
import React, { CSSProperties, RefObject } from 'react';
import tinycolor from 'tinycolor2';
import { useTheme2 } from '../../themes/ThemeContext';
import { useButton } from '@react-aria/button';
import { PressEvent } from '@react-types/shared';

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
  onPress?: (e: PressEvent) => void;
}

/** @internal */
export const ColorSwatch = React.forwardRef<HTMLDivElement, Props>(
  ({ color, label, variant = ColorSwatchVariant.Small, isSelected, onPress, ...otherProps }, ref) => {
    const theme = useTheme2();

    const { buttonProps } = useButton({ onPress }, ref as RefObject<HTMLElement>);
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

    return (
      <div
        ref={ref}
        style={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
        }}
        {...otherProps}
        {...buttonProps}
      >
        {hasLabel && <span>{label}</span>}
        <button style={swatchStyles} {...focusProps} />
      </div>
    );
  }
);

ColorSwatch.displayName = 'ColorSwatch';
