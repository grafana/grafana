import { css } from '@emotion/css';
export const getStyles = ({ colors, spacing }) => ({
    infoWrapper: css `
    display: flex;
    flex-direction: column;
    background-color: ${colors.bg2};
    padding: ${spacing.sm};
    margin-top: ${spacing.md};
    margin-bottom: ${spacing.md};
    button {
      height: 100%;
      span {
        white-space: break-spaces;
      }
    }
  `,
    infoItems: css `
    list-style-position: inside;
    margin-left: ${spacing.sm};
  `,
});
//# sourceMappingURL=DiscoveryDocs.styles.js.map