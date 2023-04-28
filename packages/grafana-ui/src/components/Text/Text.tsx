import React, { useCallback } from 'react';

import { useStyles2 } from '../../themes';

import { getTextStyles, TextStyleProps } from './style';

export interface TextProps extends TextStyleProps {
  children: React.ReactNode;
}

export const Text = React.forwardRef<HTMLElement, TextProps>(
  ({ variant, weight, color, truncate, textAlignment, children }, ref) => {
    const styles = useStyles2(
      useCallback(
        (theme) => getTextStyles(theme, variant, color, weight, truncate, textAlignment),
        [color, textAlignment, truncate, weight, variant]
      )
    );

    return (
      <span ref={ref} className={styles}>
        {children}
      </span>
    );
  }
);

Text.displayName = 'Text';
