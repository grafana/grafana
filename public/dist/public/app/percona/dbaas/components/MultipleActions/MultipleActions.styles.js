import { css } from '@emotion/css';
export const getStyles = ({ colors }) => ({
    disabledButton: css `
    color: ${colors.formInputDisabledText};
    background-color: ${colors.dropdownBg};
    pointer-events: none;

    :hover {
      background-color: ${colors.dropdownBg} !important;
    }
  `,
    iconWrapper: css `
    display: flex;
    justify-content: center;
    align-items: center;
  `,
    icon: css `
    margin-right: 0;
  `,
});
//# sourceMappingURL=MultipleActions.styles.js.map