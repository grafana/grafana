import React, { forwardRef, HTMLAttributes } from 'react';
import { css, cx } from '@emotion/css';
import { useStyles2 } from '../../themes';
import { GrafanaTheme2 } from '@grafana/data';

export interface Props extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const ToolbarButtonRow = forwardRef<HTMLDivElement, Props>(({ className, children, ...rest }, ref) => {
  const styles = useStyles2(getStyles);

  return (
    <div ref={ref} className={cx(styles.wrapper, className)} {...rest}>
      {children}
    </div>
  );
});

ToolbarButtonRow.displayName = 'ToolbarButtonRow';

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    display: flex;

    > .button-group,
    > .toolbar-button {
      margin-left: ${theme.spacing(1)};

      &:first-child {
        margin-left: 0;
      }
    }
  `,
});
