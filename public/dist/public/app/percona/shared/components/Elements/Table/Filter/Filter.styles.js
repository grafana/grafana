import { css } from '@emotion/css';
export const getStyles = ({ v1: { colors, spacing, typography } }) => {
    return {
        searchSelect: css `
      margin: 0;
    `,
        searchTextInput: css `
      margin: 0;
    `,
        filterWrapper: css `
      background-color: ${colors.bg2};
      border: 1px solid ${colors.border2};
      border-bottom: none;
      padding: ${spacing.xxs} ${spacing.md};
      display: flex;
      justify-content: space-between;
      align-items: center;
    `,
        filterLabel: css `
      font-size: ${typography.size.md};
    `,
        filterActionsWrapper: css `
      display: flex;
      justify-content: right;
      align-items: center;
      gap: ${spacing.xs};
      width: 33%;
    `,
        advanceFilter: css `
      border-top: 1px solid ${colors.border2};
      padding: ${spacing.md};
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: ${spacing.md};
    `,
        searchFields: css `
      display: flex;
      gap: ${spacing.xs};
      width: 100%;
    `,
        icon: css `
      margin-top: ${spacing.xs};
      margin-bottom: ${spacing.xs};
    `,
    };
};
//# sourceMappingURL=Filter.styles.js.map