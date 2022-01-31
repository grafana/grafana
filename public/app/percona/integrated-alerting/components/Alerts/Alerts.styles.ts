import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ colors, spacing }: GrafanaTheme) => ({
  labelsWrapper: css`
    padding: 5px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    margin-bottom: -${spacing.sm};

    & > * {
      margin-right: ${spacing.sm};
      margin-bottom: ${spacing.sm};
    }
  `,
  disabledRow: css`
    background-color: ${colors.dashboardBg} !important;
  `,
  silencedSeverity: css`
    color: inherit;
  `,
});
