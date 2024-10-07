import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ spacing, typography }: GrafanaTheme2) => ({
  infoIcon: css`
    margin-left: ${spacing(0.5)};
    margin-right: ${spacing(1)};
  `,
  currentVersion: css`
    p {
      font-size: ${typography.body.fontSize};
      line-height: ${typography.body.lineHeight};
      margin-bottom: ${spacing(0.25)};
    }
  `,
  releaseDate: css`
    font-size: ${typography.bodySmall.fontSize};
  `,
});
