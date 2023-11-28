import { css } from '@emotion/css';
export const getStyles = ({ v1: { typography, spacing, colors } }) => ({
    labelWrapper: css `
    align-items: center;
    display: flex;
    flex-direction: row;
    div[class$='-Icon'] {
      display: flex;
      margin-left: ${spacing.xs};
      margin-bottom: ${spacing.xxs};
    }
  `,
    label: css `
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
    text-align: left;
    font-size: ${typography.size.md};
    font-weight: ${typography.weight.semibold};
    line-height: ${typography.lineHeight.sm};
    margin: ${spacing.formLabelMargin};
    padding: ${spacing.formLabelPadding};
    color: ${colors.formLabel};
  `,
});
//# sourceMappingURL=LabelCore.styles.js.map