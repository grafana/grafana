import React from 'react';
import { useTheme } from '../../../themes/ThemeContext';
import { getInputStyles } from '../Input/Input';
import { cx, css } from 'emotion';

export const IndicatorsContainer = React.forwardRef<HTMLDivElement, React.PropsWithChildren<any>>((props, ref) => {
  const { children } = props;
  const theme = useTheme();
  const styles = getInputStyles({ theme, invalid: false });

  return (
    <div
      className={cx(
        styles.suffix,
        css`
          position: relative;
          top: 1px;
        `
      )}
      ref={ref}
    >
      {children}
    </div>
  );
});
