import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ v1: { spacing } }: GrafanaTheme2) => ({
  pageSwitcherWrapper: css`
    display: flex;
    padding: ${spacing.lg} 0px ${spacing.lg} 0px;
    & > label {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 50px;
      min-width: 200px;
      white-space: pre-line;
      line-height: inherit;
    }
  `,
});
