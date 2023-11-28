import { css } from '@emotion/css';
export const getStyles = ({ spacing, palette, typography, colors }) => ({
    field: css `
    &:not(:last-child) {
      margin-bottom: ${spacing.formInputMargin};
    }
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding-top: ${spacing.md};
  `,
    label: css `
    display: block;
    text-align: left;
    font-size: ${typography.size.md};
    font-weight: ${typography.weight.semibold};
    line-height: 1.25;
    padding: ${spacing.formLabelPadding};
    color: ${colors.formLabel};
  `,
    fieldWithLabelWrapper: css `
    display: flex;
    flex-direction: row;
    gap: ${spacing.sm};
    margin-left: ${spacing.md};
  `,
    labelWrapper: css `
    align-items: center;
    display: flex;
    flex-direction: row;
    div[class$='-Icon'] {
      display: flex;
      margin-left: ${spacing.xs};
    }
  `,
    errorMessage: css `
    color: ${palette.red};
    font-size: ${typography.size.sm};
    height: ${typography.size.sm};
    line-height: ${typography.lineHeight.sm};
    margin-top: ${spacing.sm};
    margin-bottom: ${spacing.xs};
  `,
});
//# sourceMappingURL=Switch.styles.js.map