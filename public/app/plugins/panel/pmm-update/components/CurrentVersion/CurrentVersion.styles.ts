import { css } from '@emotion/css';

import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing, typography }: GrafanaTheme) => ({
  infoIcon: css`
    margin-left: ${spacing.xs};
    margin-right: ${spacing.sm};
  `,
  currentVersion: css`
    p {
      font-size: ${typography.size.md};
      line-height: ${typography.lineHeight.sm};
      margin-bottom: ${spacing.xxs};
    }
  `,
  releaseDate: css`
    font-size: ${typography.size.sm};
  `,
});
