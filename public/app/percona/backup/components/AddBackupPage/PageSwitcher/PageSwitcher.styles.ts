import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ v1: { spacing } }: GrafanaTheme2) => ({
  pageSwitcherWrapper: css`
    display: flex;
    padding: ${spacing.lg} 0px ${spacing.lg} 0px;
    margin-bottom: ${spacing.lg};
    & > label {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 50px;
      width: 200px;
    }
  `,
});
