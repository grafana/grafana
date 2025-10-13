import { css } from '@emotion/css';

import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing, colors }: GrafanaTheme) => ({
  addWrapper: css`
    display: flex;
    justify-content: flex-end;
    margin-bottom: ${spacing.sm};
  `,
  disabledRow: css`
    background-color: ${colors.dashboardBg} !important;
  `,
});
