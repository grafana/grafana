import { css } from '@emotion/css';
const arrow = css `
  position: absolute;
  right: 0.3em;
  width: 0;
  height: 0;
  border-style: solid;
`;
export const getStyles = ({ v1 }) => {
    const { border, colors, palette, spacing, typography } = v1;
    const button = css `
    position: absolute;
    border: none;
    right: ${spacing.xxs};
    width: 1.2em;
    text-align: center;
    cursor: default;
    background: transparent;
    z-index: 1;
    color: ${colors.formInputText};

    &:focus {
      outline: none;
    }
  `;
    return {
        arrowUp: css `
      ${arrow};
      bottom: ${spacing.xxs};
      border-width: 0 0.3em 0.3em;
      border-color: transparent transparent currentColor;
    `,
        arrowDown: css `
      ${arrow};
      top: ${spacing.xxs};
      border-width: 0.3em 0.3em 0;
      border-color: currentColor transparent transparent;
    `,
        buttonDown: css `
      ${button};
      bottom: 2px;
      top: 50%;
    `,
        buttonUp: css `
      ${button};
      bottom: 50%;
      top: ${spacing.xxs};
    `,
        inputWrapper: css `
      position: relative;
      display: inline-block;
      width: 100%;
      &,
      &:hover {
        input[type='number']::-webkit-outer-spin-button,
        input[type='number']::-webkit-inner-spin-button {
          -webkit-appearance: none !important;
          margin: 0 !important;
        }
        input[type='number'] {
          -moz-appearance: textfield !important;
        }
      }
    `,
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
      border-radius: ${border.radius.sm};
      outline: transparent dotted 2px;
      &:focus {
        outline-offset: 2px;
        box-shadow: rgb(255, 255, 255) 0px 0px 0px 2px, rgb(87, 148, 242) 0px 0px 0px 4px;
        outline: none;
        transition: all 0.2s cubic-bezier(0.19, 1, 0.22, 1) 0s;
      }
    `,
    };
};
//# sourceMappingURL=NumberInput.styles.js.map