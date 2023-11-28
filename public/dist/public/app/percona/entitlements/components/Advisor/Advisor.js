import React from 'react';
import { Icon, useStyles2 } from '@grafana/ui';
import { getStyles } from './Advisor.styles';
export const Advisor = ({ label, hasAdvisor }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.advisorWrapper },
        React.createElement("span", { className: styles.tab },
            label,
            ":"),
        hasAdvisor ? (React.createElement(Icon, { "data-testid": "advisor-check-icon", name: "check", className: styles.checkIcon })) : (React.createElement(Icon, { "data-testid": "advisor-times-icon", name: "times", className: styles.timesIcon }))));
};
//# sourceMappingURL=Advisor.js.map