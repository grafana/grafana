import { css } from '@emotion/css';
export const getStyles = ({ palette, spacing }) => ({
    modalWrapper: css `
    div[data-testid='modal-body'] {
      max-width: none;
    }
  `,
    updateModalContent: css `
    margin-bottom: ${spacing.xl};
  `,
    highlight: css `
    color: ${palette.warn};
  `,
});
//# sourceMappingURL=UpdateDBClusterModal.styles.js.map