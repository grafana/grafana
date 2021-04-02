import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '@grafana/ui';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';
import { css } from '@emotion/css';
import React, { FC } from 'react';

type Props = {
  status: PromAlertingRuleState;
};

export const StateColoredText: FC<Props> = ({ children, status }) => {
  const styles = useStyles(getStyles);

  return <span className={styles[status]}>{children || status}</span>;
};

const getStyles = (theme: GrafanaTheme) => ({
  [PromAlertingRuleState.Inactive]: css`
    color: ${theme.palette.brandSuccess};
  `,
  [PromAlertingRuleState.Pending]: css`
    color: ${theme.palette.brandWarning};
  `,
  [PromAlertingRuleState.Firing]: css`
    color: ${theme.palette.brandDanger};
  `,
});
