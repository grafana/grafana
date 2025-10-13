import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ v1 }: GrafanaTheme2) => {
  const { spacing, colors, border } = v1;

  return {
    dropdown: css`
      z-index: 1;
    `,
    dropdownMenu: css`
      display: flex;
      flex-direction: column;
      background-color: ${colors.dropdownBg};
      border-radius: ${border.radius.md};
      box-shadow: 0 0 ${spacing.sm} 0 ${colors.dropdownShadow};
      padding: ${spacing.xs} 0;

      & > * {
        justify-content: flex-start;
        padding: ${spacing.sm} ${spacing.md};
        align-items: center;
        cursor: pointer;
        min-width: 120px;

        &:hover,
        &:active,
        &.active {
          background-color: ${colors.dropdownOptionHoverBg};
        }

        &:not(:last-child) {
          border-bottom: ${border.width.sm} solid ${colors.border1};
        }
        &:first-child {
          border-top-left-radius: ${border.radius.md};
          border-top-right-radius: ${border.radius.md};
        }
        &:last-child {
          border-bottom-left-radius: ${border.radius.md};
          border-bottom-right-radius: ${border.radius.md};
        }
      }
    `,
  };
};
