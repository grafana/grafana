import { css } from '@emotion/css';
export const getStyles = ({ spacing, typography }) => ({
    modalWrapper: css `
    max-height: 75vh;
    overflow: auto;
    padding: ${spacing.xs};
  `,
    spinnerWrapper: css `
    align-items: center;
    display: flex;
    justify-content: center;
  `,
    header: css `
    align-items: center;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    margin-bottom: ${spacing.md};
  `,
    podsLabel: css `
    flex: 1;
    font-size: ${typography.size.lg};
  `,
    expandButton: css `
    margin-right: ${spacing.md};
  `,
    modal: css `
    div[data-testid='modal-body'] {
      max-width: unset;
      width: 80%;
    }
  `,
});
//# sourceMappingURL=DBClusterLogsModal.styles.js.map