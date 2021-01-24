import React, { forwardRef, HTMLAttributes } from 'react';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '../../themes';

export interface Props extends HTMLAttributes<HTMLDivElement> {
  className?: string;
  noSpacing?: boolean;
}

export const ButtonGroup = forwardRef<HTMLDivElement, Props>(({ noSpacing, className, children, ...rest }, ref) => {
  const styles = useStyles(getStyles);
  const mainClass = cx(
    {
      [styles.wrapper]: !noSpacing,
      [styles.wrapperNoSpacing]: noSpacing,
    },
    className
  );

  return (
    <div ref={ref} className={mainClass} {...rest}>
      {children}
    </div>
  );
});

ButtonGroup.displayName = 'ButtonGroup';

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

      &:last-of-type {
        border-radius: 0 ${theme.border.radius.sm} ${theme.border.radius.sm} 0;
        border-right: 1px solid ${theme.colors.border2};
      }

      &:first-child {
        border-radius: ${theme.border.radius.sm} 0 0 ${theme.border.radius.sm};
      }
    }
  `,
});
