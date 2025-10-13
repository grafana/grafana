import { css } from '@emotion/css';

import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing, typography }: GrafanaTheme) => ({
  wrapper: css`
    overflow: hidden;
    text-overflow: ellipsis;
  `,
  nameSpan: css`
    margin-right: ${spacing.md};
    font-weight: ${typography.weight.semibold};
    white-space: nowrap;
  `,
});
