import { css } from '@emotion/css';
export const getStyles = ({ typography, colors, v1: { spacing } }, disabled) => ({
    collapsableSection: css `
    border: ${disabled ? '1px solid ' + colors.border.medium : 'none'};
    background-color: ${colors.background.primary};
    color: ${disabled && colors.text.disabled};
  `,
    collapsableHeader: css `
    padding: 20px;
    width: 100%;
    background-color: ${colors.background.secondary};
  `,
    collapsableHeaderLabel: css `
    width: 100%;
  `,
    collapsableBody: css `
    padding: 2px 0 0 0;
  `,
    collapsableLabel: css `
    display: grid;
    gap: 20px;
    grid-template-columns: 1fr 2fr 1fr;
    width: 100%;
  `,
    mainLabel: css `
    font-weight: ${typography.fontWeightBold};
    font-size: ${typography.fontSize}px;
  `,
    label: css `
    font-size: ${typography.fontSize}px;
    font-weight: ${typography.fontWeightLight};
    max-width: 600px;
  `,
});
//# sourceMappingURL=CustomCollapsableSection.styles.js.map