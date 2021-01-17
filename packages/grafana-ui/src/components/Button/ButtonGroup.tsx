import React, { forwardRef, HTMLAttributes } from 'react';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '../../themes';

export interface Props extends HTMLAttributes<HTMLDivElement> {
  noSpacing?: boolean;
}

export const ButtonGroup = forwardRef<HTMLDivElement, Props>(({ noSpacing, children, ...rest }, ref) => {
  const styles = useStyles(getStyles);
  const className = cx({
    [styles.wrapper]: !noSpacing,
    [styles.wrapperNoSpacing]: noSpacing,
  });

  return (
    <div ref={ref} className={className} {...rest}>
      {children}
    </div>
  );
});

const getStyles = (theme: GrafanaTheme) => ({
  wrapper: css`
    display: flex;

    > a,
    > button {
      margin-left: ${theme.spacing.sm};

      &:first-child {
        margin-left: 0;
      }
    }
  `,
  wrapperNoSpacing: css`
    display: flex;

    > a,
    > button {
      border-radius: 0;
      border-right: 0;

      &:last-child {
        border-radius: 0 3px 3px 0;
        border-right: 1px solid ${theme.colors.border2};
      }

      &:first-child {
        border-radius: 3px 0 0 3px;
      }
    }
  `,
});
