import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing, typography }: GrafanaTheme) => ({
  connectionItemWrapper: css`
    display: flex;
    margin-bottom: ${spacing.xxs};
  `,
  connectionItemLabel: css`
    font-weight: ${typography.weight.bold};
  `,
  connectionItemValue: css`
    margin-left: ${spacing.xs};
  `,
});
