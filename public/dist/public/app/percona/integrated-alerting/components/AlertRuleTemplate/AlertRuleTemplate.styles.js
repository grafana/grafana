import { css } from '@emotion/css';
export const getStyles = ({ v1: { spacing, typography, colors } }) => ({
    actionsWrapper: css `
    display: flex;
    justify-content: flex-end;
  `,
    dateWrapper: css `
    font-size: ${typography.size.xs};
    color: ${colors.textFaint};
  `,
});
//# sourceMappingURL=AlertRuleTemplate.styles.js.map