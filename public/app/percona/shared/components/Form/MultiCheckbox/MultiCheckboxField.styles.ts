import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme) => {
  const { colors, palette, spacing, typography } = theme;

  return {
    field: css`
      &:not(:last-child) {
        margin-bottom: ${spacing.formInputMargin};
      }
    `,
    errorMessage: css`
      color: ${palette.redBase};
      font-size: ${typography.size.sm};
      height: ${typography.size.sm};
      line-height: ${typography.lineHeight.sm};
      margin: ${spacing.formValidationMessageMargin};
      padding: ${spacing.formLabelPadding};
    `,
    label: css`
      display: block;
      text-align: left;
      font-size: ${typography.size.md};
      font-weight: ${typography.weight.semibold};
      line-height: 1.25;
      margin: ${spacing.formLabelMargin};
      padding: ${spacing.formLabelPadding};
      color: ${colors.formLabel};
    `,
    getOptionsWrapperStyles: (invalid: boolean) => {
      const borderColor = invalid ? palette.brandDanger : colors.formInputBorder;

      return css`
        background-color: ${colors.formInputBg};
        border: 1px solid ${borderColor};
        display: flex;
        flex-direction: column;
        padding: ${spacing.xs} ${spacing.sm};
        overflow: auto;
        &:hover {
          border-color: ${invalid ? borderColor : colors.formInputBorderHover};
        }
      `;
    },
    optionWrapper: css`
      display: flex;
      margin: ${spacing.xs} 0;
      div[data-qa$='-error-message'] {
        display: none;
      }
      label {
        bottom: 11px;
      }
    `,
    optionLabel: css`
      flex: 1;
    `,
    recommendedLabel: css`
      color: ${colors.textBlue};
      margin-left: ${spacing.sm};
      margin-right: ${spacing.lg};
    `,
  };
};
