import React, { useMemo } from 'react';

import { useTheme2 } from '../../themes';

import { getTextStyles, TextStyleProps } from './styles';

export interface TextProps extends TextStyleProps {
  children: React.ReactNode;

  /** What typograpy variant should be used for the component. Only use if default variant for the defined element is not what is needed */
  variant?: 'body' | 'bodySmall';
}

export const Text = React.forwardRef<HTMLElement, TextProps>(
  ({ children, weight, fontStyle, color, truncate, textAlignment, variant }, ref) => {
    const theme = useTheme2();

    const styles = useMemo(() => {
      return getTextStyles(theme, {
        weight,
        fontStyle,
        color,
        truncate,
        textAlignment,
        variant,
      });
    }, [theme, weight, fontStyle, color, truncate, textAlignment, variant]);

    return (
      <span ref={ref} className={styles}>
        {children}
      </span>
    );
  }
);

Text.displayName = 'Text';
