import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';
import { SilenceState, AlertState } from 'app/plugins/datasource/alertmanager/types';
import { css, cx } from '@emotion/css';
import React, { FC } from 'react';

type Props = {
  status: PromAlertingRuleState | SilenceState | AlertState;
};

export const StateTag: FC<Props> = ({ children, status }) => {
  const styles = useStyles2(getStyles);

  return <span className={cx(styles.common, styles[status])}>{children || status}</span>;
};

const getStyles = (theme: GrafanaTheme2) => ({
  common: css`
    display: inline-block;
    color: white;
    border-radius: ${theme.shape.borderRadius()};
    font-size: ${theme.typography.size.sm};
    padding: ${theme.spacing(0.5, 1)};
    text-transform: capitalize;
    line-height: 1.2;
  `,
  [PromAlertingRuleState.Inactive]: css`
    background-color: ${theme.colors.success.main};
    border: solid 1px ${theme.colors.success.main};
    color: ${theme.colors.success.contrastText};
  `,
  [PromAlertingRuleState.Pending]: css`
    background-color: ${theme.colors.warning.main};
    border: solid 1px ${theme.colors.warning.main};
    color: ${theme.colors.warning.contrastText};
  `,
  [PromAlertingRuleState.Firing]: css`
    background-color: ${theme.colors.error.main};
    border: solid 1px ${theme.colors.error.main};
    color: ${theme.colors.error.contrastText};
  `,
  [SilenceState.Expired]: css`
    background-color: ${theme.colors.secondary.main};
    border: solid 1px ${theme.colors.secondary.main};
    color: ${theme.colors.secondary.contrastText};
  `,
  [SilenceState.Active]: css`
    background-color: ${theme.colors.success.main};
    border: solid 1px ${theme.colors.success.main};
    color: ${theme.colors.success.contrastText};
  `,
  [AlertState.Unprocessed]: css`
    background-color: ${theme.colors.secondary.main};
    border: solid 1px ${theme.colors.secondary.main};
    color: ${theme.colors.secondary.contrastText};
  `,
  [AlertState.Suppressed]: css`
    background-color: ${theme.colors.primary.main};
    border: solid 1px ${theme.colors.primary.main};
    color: ${theme.colors.primary.contrastText};
  `,
});
