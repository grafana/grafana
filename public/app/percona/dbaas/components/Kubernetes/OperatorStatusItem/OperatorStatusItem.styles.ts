import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing, typography }: GrafanaTheme) => ({
  connectionItemWrapper: css`
    display: flex;
    align-items: center;
    margin-bottom: ${spacing.xxs};
  `,
  connectionItemLabel: css`
    font-weight: ${typography.weight.bold};
  `,
  connectionItemValue: css`
    margin-left: ${spacing.sm};
  `,
});
