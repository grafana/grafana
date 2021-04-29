import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme) => {
  const { colors } = theme;
  const cellPadding = 16;

  return {
    labelsWrapper: css`
      padding: 5px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      margin: 0 -${cellPadding}px;
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
  };
};
