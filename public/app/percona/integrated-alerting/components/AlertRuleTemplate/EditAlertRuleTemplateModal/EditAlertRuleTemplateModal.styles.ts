import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

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
