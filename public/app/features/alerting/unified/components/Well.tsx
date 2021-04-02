import React, { FC } from 'react';
import { useStyles } from '@grafana/ui';
import { cx, css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';

type Props = React.HTMLAttributes<HTMLDivElement>;

export const Well: FC<Props> = ({ children, className }) => {
  const styles = useStyles(getStyles);
  return <div className={cx(styles.wrapper, className)}>{children}</div>;
};
export const getStyles = (theme: GrafanaTheme) => ({
  wrapper: css`
    background-color: ${theme.colors.panelBg};
    border: solid 1px ${theme.colors.formInputBorder};
    border-radius: ${theme.border.radius.sm};
    padding: ${theme.spacing.xs} ${theme.spacing.sm};
    font-family: ${theme.typography.fontFamily.monospace};
  `,
});
