import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ v1: { spacing } }: GrafanaTheme2) => ({
  pageSwitcherWrapper: css`
    display: flex;
    padding: ${spacing.lg} 0px ${spacing.lg} 0px;
    margin-bottom: ${spacing.lg};
    gap: 10px;
    /* & > label {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 50px;
      width: 200px;
    } */
  `,
  wrapper: css`
    width: 380px;
    cursor: pointer;
    user-select: none;
  `,
  disabled: css`
    opacity: 0.5;
  `,
});
