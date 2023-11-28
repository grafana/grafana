import { css } from '@emotion/css';
export const getStyles = ({ colors, spacing }) => ({
    infoBox: css `
    margin: 10px 0;
    display: flex;
    flex-direction: column;
    flex: 1;
    justify-content: center;
    align-items: center;
    box-sizing: border-box;
    border: 1px solid #292929;
    text-align: center;
    padding: ${spacing.xs};
  `,
    link: css `
    color: ${colors.linkExternal};
    &:hover {
      color: ${colors.textBlue};
    }
  `,
});
//# sourceMappingURL=InfoBox.styles.js.map