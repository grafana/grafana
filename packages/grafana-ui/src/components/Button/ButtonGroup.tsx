import { css, cx } from '@emotion/css';
import React, { forwardRef, HTMLAttributes } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';

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

    '> .button-group:not(:first-child) > button, > button:not(:first-child)': {
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0,
    },

    '> .button-group:not(:last-child) > button, > button:not(:last-child)': {
      borderTopRightRadius: 0,
      borderBottomRightRadius: 0,
      borderRightWidth: 0,
    },
  }),
});
