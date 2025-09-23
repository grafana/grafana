import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ spacing, typography }: GrafanaTheme2) => ({
  availableUpdate: css`
    align-items: flex-start;
    display: flex;
    font-weight: ${typography.fontWeightBold};
    justify-content: flex-start;
    line-height: ${typography.bodySmall.lineHeight};
    margin-top: ${spacing(0.5)};

    > div {
      display: flex;
    }

    a {
      margin: 0;
    }
  `,
  whatsNewLink: css`
    height: 1em;
    margin-top: ${spacing(0.5)};
    padding: 0;
  `,
  releaseDate: css`
    font-size: ${typography.size.sm};
    font-weight: ${typography.fontWeightRegular};
  `,
  latestVersion: css`
    margin-right: ${spacing(0.5)};
  `,
  infoIcon: css`
    margin-left: ${spacing(0.5)};
    margin-right: ${spacing(1)};
  `,
});
