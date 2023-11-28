import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';
export const StateColoredText = ({ children, status }) => {
    const styles = useStyles2(getStyles);
    return React.createElement("span", { className: styles[status] }, children || status);
};
const getStyles = (theme) => ({
    [PromAlertingRuleState.Inactive]: css `
    color: ${theme.colors.success.text};
  `,
    [PromAlertingRuleState.Pending]: css `
    color: ${theme.colors.warning.text};
  `,
    [PromAlertingRuleState.Firing]: css `
    color: ${theme.colors.error.text};
  `,
    neutral: css `
    color: ${theme.colors.text.secondary};
  `,
});
//# sourceMappingURL=StateColoredText.js.map