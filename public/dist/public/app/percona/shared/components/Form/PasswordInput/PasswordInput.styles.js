/* eslint-disable max-len */
import { css } from '@emotion/css';
export const getStyles = ({ v1 }) => {
    const { border, colors, isDark, palette, spacing, typography } = v1;
    const focusBoxShadow = isDark
        ? 'rgb(20, 22, 25) 0px 0px 0px 2px, rgb(31, 96, 196) 0px 0px 0px 4px'
        : 'rgb(255, 255, 255) 0px 0px 0px 2px, rgb(87, 148, 242) 0px 0px 0px 4px';
    const autofillFocusBoxShadow = isDark
        ? css `
        box-shadow: rgb(20, 22, 25) 0px 0px 0px 2px, rgb(31, 96, 196) 0px 0px 0px 4px,
          rgba(255, 255, 255, 0) 0px 0px 0px 1px inset, rgb(11, 12, 14) 0px 0px 0px 100px inset !important;
        -webkit-text-fill-color: rgb(199, 208, 217) !important;
      `
        : css `
        box-shadow: rgb(255, 255, 255) 0px 0px 0px 2px, rgb(87, 148, 242) 0px 0px 0px 4px,
          rgba(255, 255, 255, 0) 0px 0px 0px 1px inset, rgb(255, 255, 255) 0px 0px 0px 100px inset !important;
        -webkit-text-fill-color: rgb(70, 76, 84) !important;
      `;
    const autofillBoxShadow = isDark
        ? css `
        box-shadow: rgba(255, 255, 255, 0) 0px 0px 0px 1px inset, rgb(11, 12, 14) 0px 0px 0px 100px inset !important;
        -webkit-text-fill-color: rgb(199, 208, 217) !important;
      `
        : css `
        box-shadow: rgba(255, 255, 255, 0) 0px 0px 0px 1px inset, rgb(255, 255, 255) 0px 0px 0px 100px inset !important;
        -webkit-text-fill-color: rgb(70, 76, 84) !important;
      `;
    return {
        field: css `
      &:not(:last-child) {
        margin-bottom: ${spacing.formInputMargin};
      }
    `,
        errorMessage: css `
      color: ${palette.redBase};
      font-size: ${typography.size.sm};
      height: ${typography.size.sm};
      line-height: ${typography.lineHeight.sm};
      margin: ${spacing.formValidationMessageMargin};
      padding: ${spacing.formLabelPadding};
    `,
        label: css `
      display: block;
      text-align: left;
      font-size: ${typography.size.md};
      font-weight: ${typography.weight.semibold};
      line-height: 1.25;
      margin: ${spacing.formLabelMargin};
      padding: ${spacing.formLabelPadding};
      color: ${colors.formLabel};
    `,
        input: css `
      background-color: ${colors.formInputBg};
      line-height: ${typography.lineHeight.md};
      font-size: ${typography.size.md};
      color: ${colors.formInputText};
      position: relative;
      z-index: 0;
      width: 100%;
      border-width: ${border.width.sm};
      border-style: solid;
      border-color: ${colors.formInputBorder};
      &.invalid {
        border-color: ${colors.formInputBorderInvalid};
        &:hover {
          border-color: ${colors.formInputBorderInvalid};
        }
      }
      &:hover {
        border-color: ${colors.formInputBorderHover};
      }
      &:disabled {
        background-color: ${colors.formInputBgDisabled};
        color: ${colors.formInputDisabledText};
      }
      border-image: initial;
      padding: 7px 8px;
      border-radius: 2px;
      outline: transparent dotted 2px;
      &:-webkit-autofill,
      &:-webkit-autofill:hover {
        ${autofillBoxShadow}
      }
      &:-webkit-autofill:focus {
        ${autofillFocusBoxShadow}
      }
      &:focus {
        outline-offset: 2px;
        box-shadow: ${focusBoxShadow};
        outline: none;
        transition: all 0.2s cubic-bezier(0.19, 1, 0.22, 1) 0s;
      }
    `,
    };
};
//# sourceMappingURL=PasswordInput.styles.js.map