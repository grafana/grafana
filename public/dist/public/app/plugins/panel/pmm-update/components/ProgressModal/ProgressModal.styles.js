import { css } from '@emotion/css';
export const getStyles = (theme) => ({
    modal: css `
    background-clip: padding-box;
    background: ${theme.colors.background.primary};
    box-shadow: 0 3px 7px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    left: 0;
    margin-left: auto;
    margin-right: auto;
    max-width: 750px;
    outline: none;
    position: fixed;
    right: 0;
    top: 10%;
    width: 100%;
    z-index: 1050;
    padding: 28px;
  `,
    outputHeader: css `
    display: flex;

    span {
      flex: 1;
    }
  `,
    clipboardButton: css `
    margin-right: 8px;
  `,
    output: css `
    height: 200px;
    margin-right: 0;
    margin-top: 15px;
    overflow-y: scroll;
    width: 100%;
  `,
    outputContent: css `
    margin-top: 15px;
    padding: 1em;
  `,
    outputVisibilityToggle: css `
    cursor: pointer;
    margin-right: 5px;
  `,
    successNote: css `
    padding: 80px;
    text-align: center;
  `,
    closeModal: css `
    align-self: center;
  `,
});
//# sourceMappingURL=ProgressModal.styles.js.map