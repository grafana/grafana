import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

export type State = 'good' | 'bad' | 'warning' | 'neutral' | 'info';

type Props = {
  state: State;
  size?: 'md' | 'sm';
  muted?: boolean;
};

export const StateTag = ({ children, state, size = 'md', muted = false }: React.PropsWithChildren<Props>) => {
  const styles = useStyles2(getStyles);

  return (
    <span className={cx(styles.common, styles[state], styles[size], { [styles.muted]: muted })}>
      {children || state}
    </span>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  common: css`
    display: inline-block;
    color: white;
    border-radius: ${theme.shape.borderRadius()};
    font-size: ${theme.typography.size.sm};
    text-transform: capitalize;
    line-height: 1.2;
    text-align: center;
    font-weight: ${theme.typography.fontWeightBold};
  `,
  good: css`
    background-color: ${theme.colors.success.main};
    border: solid 1px ${theme.colors.success.main};
    color: ${theme.colors.success.contrastText};
  `,
  warning: css`
    background-color: ${theme.colors.warning.main};
    border: solid 1px ${theme.colors.warning.main};
    color: ${theme.colors.warning.contrastText};
  `,
  bad: css`
    background-color: ${theme.colors.error.main};
    border: solid 1px ${theme.colors.error.main};
    color: ${theme.colors.error.contrastText};
  `,
  neutral: css`
    background-color: ${theme.colors.secondary.main};
    border: solid 1px ${theme.colors.secondary.main};
    color: ${theme.colors.secondary.contrastText};
  `,
  info: css`
    background-color: ${theme.colors.primary.main};
    border: solid 1px ${theme.colors.primary.main};
    color: ${theme.colors.primary.contrastText};
  `,
  md: css`
    padding: ${theme.spacing(0.5, 1)};
    min-width: ${theme.spacing(8)};
  `,
  sm: css`
    padding: ${theme.spacing(0.3, 0.5)};
    min-width: 52px;
  `,
  muted: css`
    opacity: 0.5;
  `,
});
