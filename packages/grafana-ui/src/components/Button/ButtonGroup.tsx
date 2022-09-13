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
  wrapper: css`
    display: flex;

    > .button-group:not(:first-child) > button,
    > button:not(:first-child) {
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
    }

    > .button-group:not(:last-child) > button,
    > button:not(:last-child) {
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
      border-right-width: 0;
    }
  `,
});
