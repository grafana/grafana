import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ v1: { colors, spacing } }: GrafanaTheme2) => {
  const labelStyles = `
    margin-right: ${spacing.sm};
    margin-bottom: ${spacing.sm};
    word-break: break-word;
  `;
  const labelContainer = `
    margin-right: -${spacing.sm};
    margin-bottom: -${spacing.sm};
  `;

  return {
    link: css`
      color: ${colors.linkExternal};
      &:hover {
        color: ${colors.textBlue};
      }
    `,
    chips: css`
      ${labelContainer};
      display: flex;
      flex-wrap: wrap;
      align-items: center;

      & > * {
        ${labelStyles}
      }
    `,
    actions: css`
      display: flex;
      align-items: center;
      justify-content: center;
    `,
    disabledRow: css`
      background-color: ${colors.dashboardBg} !important;
    `,
    secondaryLabels: css`
      ${labelContainer};
      & > * {
        ${labelStyles}
      }
    `,
  };
};
