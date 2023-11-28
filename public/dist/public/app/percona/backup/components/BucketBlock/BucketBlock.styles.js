import { css } from '@emotion/css';
export const getStyles = ({ spacing, typography }) => ({
    wrapper: css `
    overflow: hidden;
    text-overflow: ellipsis;
  `,
    nameSpan: css `
    margin-right: ${spacing.md};
    font-weight: ${typography.weight.semibold};
    white-space: nowrap;
  `,
});
//# sourceMappingURL=BucketBlock.styles.js.map