import { css, cx } from '@emotion/css';
import { forwardRef, HTMLAttributes } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';

export interface Props extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const ButtonGroup = forwardRef<HTMLDivElement, Props>(({ className, children, ...rest }, ref) => {
  const styles = useStyles2(getStyles);

  return (
    <div ref={ref} className={cx('button-group', styles.wrapper, className)} {...rest}>
      {children}
    </div>
  );
});

ButtonGroup.displayName = 'ButtonGroup';

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    borderRadius: theme.shape.radius.default,

    '> .button-group:not(:first-child) > button, > button:not(:first-child)': {
      borderTopLeftRadius: 'unset',
      borderBottomLeftRadius: 'unset',
      borderLeft: `1px solid rgba(255, 255, 255, 0.12)`,
    },

    '> .button-group:not(:last-child) > button, > button:not(:last-child)': {
      borderTopRightRadius: 'unset',
      borderBottomRightRadius: 'unset',
      borderRight: `1px solid rgba(0, 0, 0, 0.12)`,
    },
  }),
});
