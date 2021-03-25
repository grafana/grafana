import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '@grafana/ui';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';
import { css, cx } from 'emotion';
import React, { FC } from 'react';

type Props = {
  status: PromAlertingRuleState;
};

const getStyles = (theme: GrafanaTheme) => ({
  common: css`
    display: inline-block;
    color: white;
    border-radius: 2px;
    font-size: ${theme.typography.size.sm};
    padding: ${theme.spacing.xs} ${theme.spacing.sm};
    text-transform: capitalize;
  `,
  [PromAlertingRuleState.Inactive]: css`
    background-color: ${theme.palette.brandSuccess};
  `,
  [PromAlertingRuleState.Pending]: css`
    background-color: ${theme.palette.brandWarning};
  `,
  [PromAlertingRuleState.Firing]: css`
    background-color: ${theme.palette.brandDanger};
  `,
});

export const StateTag: FC<Props> = ({ children, status }) => {
  const styles = useStyles(getStyles);

  return <span className={cx(styles.common, styles[status])}>{children || status}</span>;
};
