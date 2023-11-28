import { css } from '@emotion/css';
export const getStyles = ({ v1: { height, spacing, colors } }) => ({
    wrapper: css `
    min-height: ${height.sm}px;
    color: ${colors.text};
    line-height: ${height.sm}px;
    display: inline-flex;
    align-items: center;
    border-radius: 10px;
    padding: 0 ${spacing.sm};
    cursor: pointer;
    background-color: ${colors.bg2};
    transition: all 0.1s linear;

    &:hover {
      background-color: ${colors.bg3};
    }
  `,
    removeIcon: css `
    float: right;
    cursor: pointer;
    margin-left: ${spacing.sm};
    fill: currentColor;

    &:hover {
      color: ${colors.textStrong};
    }
  `,
});
//# sourceMappingURL=Chip.styles.js.map