import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ colors, spacing }: GrafanaTheme) => {
  return {
    generalActionsWrapper: css`
      display: flex;
      justify-content: flex-end;
      margin-bottom: ${spacing.sm};
    `,
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
    label: css`
      background-color: ${colors.bg3};
      border-radius: 8px;
      padding: 6px;
      line-height: 1;
      margin: 5px;
    `,
    disabledRow: css`
      background-color: ${colors.dashboardBg} !important;
    `,
    silencedSeverity: css`
      color: inherit;
    `,
    actionsWrapper: css`
      display: flex;
      justify-content: center;
    `,
  };
};
