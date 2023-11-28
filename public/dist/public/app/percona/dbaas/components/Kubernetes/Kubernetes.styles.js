import { css } from '@emotion/css';
export const getStyles = (theme) => ({
    actionPanel: css `
    display: flex;
    justify-content: flex-end;
    margin-bottom: ${theme.spacing.sm};
  `,
    actionsColumn: css `
    display: flex;
    justify-content: center;
  `,
    deleteModalContent: css `
    margin-bottom: ${theme.spacing.xl};
  `,
});
//# sourceMappingURL=Kubernetes.styles.js.map