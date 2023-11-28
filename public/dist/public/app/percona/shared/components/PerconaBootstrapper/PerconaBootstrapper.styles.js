import { css } from '@emotion/css';
export const getStyles = ({ v1: { spacing } }) => ({
    iconContainer: css `
    text-align: center;
    margin-bottom: ${spacing.md};
  `,
    svg: css `
    width: 70px;
    height: 70px;
  `,
    list: css `
    padding-left: ${spacing.lg};
    margin-bottom: ${spacing.lg};
  `,
    docsLink: css `
    text-decoration: underline;
  `,
    callToAction: css `
    margin-top: ${spacing.sm};
  `,
});
//# sourceMappingURL=PerconaBootstrapper.styles.js.map