import { css } from '@emotion/css';
export const getStyles = ({ spacing, typography }) => ({
    descriptionWrapper: css `
    display: flex;
    align-items: center;

    span {
      margin-right: ${spacing.md};
      font-weight: ${typography.weight.semibold};
    }

    pre {
      margin-bottom: 0;
      flex-grow: 1;
    }
  `,
});
//# sourceMappingURL=DescriptionBlock.styles.js.map