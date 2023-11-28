import { css } from '@emotion/css';
export const getStyles = ({ v1 }) => {
    const { colors, spacing, zIndex, breakpoints, typography } = v1;
    return {
        background: css `
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      left: 0;
      z-index: ${zIndex.modalBackdrop};
      background-color: ${colors.bg3};
      opacity: 0.7;
    `,
        body: css `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: ${zIndex.modal};
      background: ${colors.bodyBg};
      box-shadow: 0 0 20px ${colors.dropdownShadow};
      background-clip: padding-box;
      outline: none;
      width: 600px;
      max-width: 90%;
      @media (min-width: ${breakpoints.sm}) {
        max-width: 80%;
      }
      @media (min-width: ${breakpoints.md}) {
        max-width: 70%;
      }
      @media (min-width: ${breakpoints.lg}) {
        width: 50%;
        max-width: 60%;
      }
      @media (min-width: ${breakpoints.xl}) {
        width: 50%;
        max-width: 50%;
      }
    `,
        modalHeader: css `
      display: flex;
      height: 3em;
      align-items: center;
      justify-content: space-between;
      padding-left: ${spacing.d};
      font-weight: ${typography.weight.semibold};
      background: ${colors.bg2};
      border-bottom: 1px solid ${colors.pageHeaderBorder};
    `,
        content: css `
      padding: ${spacing.d};
      overflow: auto;
      width: 100%;
      max-height: calc(90vh - ${spacing.d});
    `,
        modalHeaderClose: css `
      height: 100%;
      width: 3em;
      display: flex;
      align-items: center;
      justify-content: center;
    `,
    };
};
//# sourceMappingURL=Modal.styles.js.map