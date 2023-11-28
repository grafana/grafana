import { css } from '@emotion/css';
export const getStyles = ({ colors, spacing, typography }) => ({
    label: css `
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
    text-align: left;
    font-size: ${typography.size.md};
    font-weight: ${typography.weight.semibold};
    line-height: 1.5;
    margin: ${spacing.formLabelMargin};
    padding: ${spacing.formLabelPadding};
    color: ${colors.formLabel};
  `,
});
//# sourceMappingURL=Label.styles.js.map