import React, { forwardRef, HTMLAttributes } from 'react';
import { css, cx } from '@emotion/css';
import { useStyles2 } from '../../themes';
import { GrafanaTheme2 } from '@grafana/data';

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

    > button {
      border-radius: 0;
      border-right-width: 0;

      &.toolbar-button {
        margin-left: 0;
      }

      &:last-of-type {
        border-radius: 0 ${theme.shape.borderRadius()} ${theme.shape.borderRadius()} 0;
        border-right-width: 1px;
      }

      &:first-child {
        border-radius: ${theme.shape.borderRadius()} 0 0 ${theme.shape.borderRadius()};
      }
    }
  `,
});
