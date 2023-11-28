import { css } from '@emotion/css';
export const getStyles = ({ spacing }) => ({
    actionsWrapper: css `
    display: flex;
    justify-content: space-between;
    align-items: center;
  `,
    button: css `
    margin-right: 0;
  `,
    editButton: css `
    margin-left: ${spacing(0.5)};
  `,
    actionLink: css `
    display: flex;
  `,
});
//# sourceMappingURL=AlertRuleTemplateActions.styles.js.map