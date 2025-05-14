import { cx, css } from '@emotion/css';
import { forwardRef } from 'react';

import { useTheme2 } from '../../themes/ThemeContext';
import { getInputStyles } from '../Input/Input';

export const IndicatorsContainer = forwardRef<HTMLDivElement, React.PropsWithChildren>((props, ref) => {
  const { children } = props;
  const theme = useTheme2();
  const styles = getInputStyles({ theme, invalid: false });

  return (
    <div
      className={cx(
        styles.suffix,
        css({
          position: 'relative',
        })
      )}
      ref={ref}
    >
      {children}
    </div>
  );
});

IndicatorsContainer.displayName = 'IndicatorsContainer';
