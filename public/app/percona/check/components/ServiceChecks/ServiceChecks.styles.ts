import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ v1: { colors: v1Colors, spacing }, colors }: GrafanaTheme2) => {
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
      color: ${v1Colors.linkExternal};
      &:hover {
        color: ${v1Colors.textBlue};
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
    disabledRow: css`
      background-color: ${colors.action.disabledBackground} !important;
      opacity: ${colors.action.disabledOpacity};
    `,
    secondaryLabels: css`
      ${labelContainer};
      & > * {
        ${labelStyles}
      }
    `,
  };
};
