import { css } from '@emotion/css';

import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing, typography }: GrafanaTheme) => ({
  descriptionWrapper: css`
    display: flex;
    align-items: center;

    span {
      margin-right: ${spacing.md};
      font-weight: ${typography.weight.semibold};
    }

    pre {
      margin-bottom: 0;
      flex-grow: 1;
    }
  `,
});
