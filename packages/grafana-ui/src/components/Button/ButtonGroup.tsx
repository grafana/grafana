import React, { forwardRef, HTMLAttributes } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '../../themes';

export interface Props extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const ButtonGroup = forwardRef<HTMLDivElement, Props>(({ className, children, ...rest }, ref) => {
  const styles = useStyles(getStyles);

  return (
    <div ref={ref} className={cx('button-group', styles.wrapper, className)} {...rest}>
      {children}
    </div>
  );
});

ButtonGroup.displayName = 'ButtonGroup';

const getStyles = (theme: GrafanaTheme) => ({
  wrapper: css`
    display: flex;
    box-shadow: ${theme.v2.shadows.z1};

    > button {
      border-radius: 0;
      border-right: 1px solid ${theme.v2.palette.border1};
      box-shadow: none;

      &.toolbar-button {
        margin-left: 0;
      }

      &:last-of-type {
        border-radius: 0 ${theme.border.radius.sm} ${theme.border.radius.sm} 0;
        border-right: none;
      }

      &:first-child {
        border-radius: ${theme.border.radius.sm} 0 0 ${theme.border.radius.sm};
      }
    }
  `,
});
