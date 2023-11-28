import { css } from '@emotion/css';
export const getStyles = ({ spacing }) => ({
    wrapper: css `
    display: flex;
    flex-direction: column;
    margin: ${spacing.xs} ${spacing.sm};
  `,
    parametersFailed: css `
    display: flex;
    justify-content: center;
  `,
});
//# sourceMappingURL=DBClusterParameters.styles.js.map