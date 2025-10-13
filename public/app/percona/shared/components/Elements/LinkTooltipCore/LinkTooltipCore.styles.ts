import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ v1: { spacing, palette } }: GrafanaTheme2) => ({
  contentWrapper: css`
    display: flex;
    flex-direction: column;
  `,
  link: css`
    color: ${palette.gray4};
    padding-top: ${spacing.sm};
    text-decoration: underline;
    &: hover {
      color: white;
      text-decoration: underline;
    }
  `,
});
