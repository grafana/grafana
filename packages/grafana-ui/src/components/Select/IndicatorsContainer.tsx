import { cx, css } from '@emotion/css';
import { forwardRef } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { getInputStyles } from '../Input/Input';

const getIndicatorsInputStyles = (theme: GrafanaTheme2) => getInputStyles({ theme, invalid: false });

export const IndicatorsContainer = forwardRef<HTMLDivElement, React.PropsWithChildren>((props, ref) => {
  const { children } = props;
  const styles = useStyles2(getIndicatorsInputStyles);

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
