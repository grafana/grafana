import { css } from '@emotion/css';
export const getSettingsStyles = ({ v1: { spacing }, breakpoints }) => {
    const mq = `@media (max-width: ${breakpoints.up('md')})`;
    return {
        pageContent: css `
      ${breakpoints.up('md')} {
        margin-right: auto !important;
        width: 45% !important;
      }
      @media (min-width: 2000px) {
        width: 30% !important;
      }
      @media (min-width: 3000px) {
        width: 20% !important;
      }
      @media (min-width: 5000px) {
        width: 12% !important;
      }
    `,
        wrapper: css `
      ${mq} {
        width: 100%;
      }
    `,
        labelWrapper: css `
      display: flex;
      flex-wrap: wrap;
      svg {
        margin-left: ${spacing.xs};
      }
    `,
        actionButton: css `
      margin-top: ${spacing.sm};
      width: fit-content;
      i {
        margin-right: ${spacing.sm};
      }
      span {
        display: flex;
      }
    `,
        tabs: css `
      background: transparent;
    `,
    };
};
//# sourceMappingURL=Settings.styles.js.map