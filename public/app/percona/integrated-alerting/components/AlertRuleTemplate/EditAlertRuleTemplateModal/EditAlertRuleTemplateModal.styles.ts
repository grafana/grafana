import { css } from '@emotion/css';

import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  alertRuleTemplate: css`
    min-height: 250px;
  `,
  field: css`
    &:not(:last-child) {
      margin-bottom: 0;
    }
  `,
  warning: css`
    margin-bottom: ${spacing.formInputMargin};
  `,
});
