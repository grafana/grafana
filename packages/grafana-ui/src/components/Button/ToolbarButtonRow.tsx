import React, { forwardRef, HTMLAttributes } from 'react';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '../../themes';

export interface Props extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const ToolbarButtonRow = forwardRef<HTMLDivElement, Props>(({ className, children, ...rest }, ref) => {
  const styles = useStyles(getStyles);

  return (
    <div ref={ref} className={cx(styles.wrapper, className)} {...rest}>
      {children}
    </div>
  );
});

ToolbarButtonRow.displayName = 'ToolbarButtonRow';

const getStyles = (theme: GrafanaTheme) => ({
  wrapper: css`
    display: flex;

    .button-group,
    .toolbar-button {
      margin-left: ${theme.spacing.sm};

      &:first-child {
        margin-left: 0;
      }
    }
  `,
});
