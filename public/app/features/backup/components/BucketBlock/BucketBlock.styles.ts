import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

export const getStyles = ({ spacing, typography }: GrafanaTheme) => ({
  nameSpan: css`
    margin-right: ${spacing.md};
    font-weight: ${typography.weight.semibold};
  `,
});
