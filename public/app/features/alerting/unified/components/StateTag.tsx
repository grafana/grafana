import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '@grafana/ui';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';
import { SilenceState, AlertState } from 'app/plugins/datasource/alertmanager/types';
import { css, cx } from '@emotion/css';
import React, { FC } from 'react';

type Props = {
  status: PromAlertingRuleState | SilenceState | AlertState;
};

export const StateTag: FC<Props> = ({ children, status }) => {
  const styles = useStyles(getStyles);

  return <span className={cx(styles.common, styles[status])}>{children || status}</span>;
};

const getStyles = (theme: GrafanaTheme) => ({
  common: css`
    display: inline-block;
    color: white;
    border-radius: ${theme.border.radius.sm};
    font-size: ${theme.typography.size.sm};
    padding: ${theme.spacing.xs} ${theme.spacing.sm};
    text-transform: capitalize;
    line-height: 1.2;
  `,
  [PromAlertingRuleState.Inactive]: css`
    background-color: ${theme.palette.brandSuccess};
    border: solid 1px ${theme.palette.brandSuccess};
  `,
  [PromAlertingRuleState.Pending]: css`
    background-color: ${theme.palette.brandWarning};
    border: solid 1px ${theme.palette.brandWarning};
  `,
  [PromAlertingRuleState.Firing]: css`
    background-color: ${theme.palette.brandDanger};
    border: solid 1px ${theme.palette.brandDanger};
  `,
  [SilenceState.Expired]: css`
    background-color: ${theme.palette.gray33};
    border: solid 1px ${theme.palette.gray33};
  `,
  [SilenceState.Active]: css`
    background-color: ${theme.palette.brandSuccess};
    border: solid 1px ${theme.palette.brandSuccess};
  `,
  [AlertState.Unprocessed]: css`
    background-color: ${theme.palette.gray33};
    border: solid 1px ${theme.palette.gray33};
  `,
  [AlertState.Suppressed]: css`
    background-color: ${theme.palette.brandPrimary};
    border: solid 1px ${theme.palette.brandPrimary};
  `,
});
