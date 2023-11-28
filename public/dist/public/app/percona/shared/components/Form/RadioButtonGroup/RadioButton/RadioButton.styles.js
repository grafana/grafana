import { css } from '@emotion/css';
export const focusCss = ({ v1: { colors } }) => `
  outline: 2px dotted transparent;
  outline-offset: 2px;
  box-shadow: 0 0 0 2px ${colors.bodyBg}, 0 0 0px 4px ${colors.formFocusOutline};
  transition: all 0.2s cubic-bezier(0.19, 1, 0.22, 1);
`;
export const getStylesFn = (size, fullWidth) => (theme) => {
    const { border, colors, height, isLight, palette, spacing, typography } = theme.v1;
    const textColor = colors.textSemiWeak;
    const textColorHover = colors.text;
    const textColorActive = colors.textBlue;
    const borderColor = colors.border2;
    const borderColorHover = colors.border3;
    const borderColorActive = colors.border2;
    const bg = colors.bodyBg;
    const bgDisabled = isLight ? palette.gray95 : palette.gray15;
    const bgActive = colors.bg2;
    const labelBorder = `1px solid ${borderColor}`;
    const borderActive = `1px solid ${borderColorActive}`;
    const borderHover = `1px solid ${borderColorHover}`;
    return {
        radio: css `
      position: absolute;
      opacity: 0;
      z-index: -1000;

      &:focus + label {
        ${focusCss(theme)};
        z-index: 3;
      }

      &:disabled + label {
        cursor: default;
        background: ${bgDisabled};
        color: ${textColor};
      }

      &:checked + label {
        border: ${borderActive};
        color: ${textColorActive};
        background: ${bgActive};
        z-index: 3;
      }

      &:disabled + label:hover {
        border: ${labelBorder};
      }
    `,
        radioLabel: css `
      display: flex;
      justify-content: center;
      position: relative;
      font-size: ${typography.size[size]};
      height: ${height[size]}px;
      // Subtract border from line-height for perfect vertical centering on windows and linux
      line-height: ${height[size] - 2}px;
      color: ${textColor};
      padding: 0 ${spacing[size]};
      margin-left: -1px;
      border-radius: ${border.radius.sm};
      border: ${labelBorder};
      background: ${bg};
      cursor: pointer;
      z-index: 1;
      flex: ${fullWidth ? '1 1 0%' : 'none'};
      text-align: center;
      user-select: none;

      &:hover {
        color: ${textColorHover};
        border: ${borderHover};
        z-index: 2;
      }
    `,
    };
};
//# sourceMappingURL=RadioButton.styles.js.map