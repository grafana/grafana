import { css } from 'emotion';

import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing, typography }: GrafanaTheme) => ({
  nameSpan: css`
    margin-right: ${spacing.md};
    font-weight: ${typography.weight.semibold};
  `,
});
