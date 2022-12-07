import { css } from '@emotion/css';

import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  headerContainer: css`
    h2 {
      margin: ${spacing.xl} ${spacing.lg} ${spacing.xs} ${spacing.lg};
    }

    hr {
      margin: ${spacing.xs} ${spacing.md};
    }
  `,
});
