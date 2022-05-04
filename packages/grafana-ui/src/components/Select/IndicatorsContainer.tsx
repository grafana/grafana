import { cx, css } from '@emotion/css';
import React from 'react';

import { useTheme2 } from '../../themes/ThemeContext';
import { getInputStyles } from '../Input/Input';

export const IndicatorsContainer = React.forwardRef<HTMLDivElement, React.PropsWithChildren<any>>((props, ref) => {
  const { children } = props;
  const theme = useTheme2();
  const styles = getInputStyles({ theme, invalid: false });

  return (
    <div
      className={cx(
        styles.suffix,
        css`
          position: relative;
        `
      )}
      ref={ref}
    >
      {children}
    </div>
  );
});

IndicatorsContainer.displayName = 'IndicatorsContainer';
