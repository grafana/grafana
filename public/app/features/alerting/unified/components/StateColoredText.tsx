import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

type Props = {
  status: PromAlertingRuleState | 'neutral';
};

export const StateColoredText = ({ children, status }: React.PropsWithChildren<Props>) => {
  const styles = useStyles2(getStyles);

  return <span className={styles[status]}>{children || status}</span>;
};

const getStyles = (theme: GrafanaTheme2) => ({
  [PromAlertingRuleState.Inactive]: css`
    color: ${theme.colors.success.text};
  `,
  [PromAlertingRuleState.Pending]: css`
    color: ${theme.colors.warning.text};
  `,
  [PromAlertingRuleState.Firing]: css`
    color: ${theme.colors.error.text};
  `,
  neutral: css`
    color: ${theme.colors.text.secondary};
  `,
});
