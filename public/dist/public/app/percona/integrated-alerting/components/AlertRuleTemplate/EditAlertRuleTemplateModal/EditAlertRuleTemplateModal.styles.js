import { css } from '@emotion/css';
export const getStyles = ({ spacing }) => ({
    alertRuleTemplate: css `
    min-height: 250px;
  `,
    field: css `
    &:not(:last-child) {
      margin-bottom: 0;
    }
  `,
    warning: css `
    margin-bottom: ${spacing.formInputMargin};
  `,
});
//# sourceMappingURL=EditAlertRuleTemplateModal.styles.js.map