import { css } from '@emotion/css';
import React from 'react';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';
export const RuleHealth = ({ rule }) => {
    const style = useStyles2(getStyle);
    if (rule.health === 'err' || rule.health === 'error') {
        return (React.createElement(Tooltip, { theme: "error", content: rule.lastError || 'No error message provided.' },
            React.createElement("div", { className: style.warn },
                React.createElement(Icon, { name: "exclamation-triangle" }),
                React.createElement("span", null, "error"))));
    }
    return React.createElement(React.Fragment, null, rule.health);
};
const getStyle = (theme) => ({
    warn: css `
    display: inline-flex;
    flex-direction: row;
    align-items: center;
    gap: ${theme.spacing(1)};

    color: ${theme.colors.warning.text};
  `,
});
//# sourceMappingURL=RuleHealth.js.map