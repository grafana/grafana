import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import { config } from '@grafana/runtime/src';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui/src';
import { checkEvaluationIntervalGlobalLimit } from '../../utils/config';
export function RuleConfigStatus({ rule }) {
    const styles = useStyles2(getStyles);
    const { exceedsLimit } = useMemo(() => checkEvaluationIntervalGlobalLimit(rule.group.interval), [rule.group.interval]);
    if (!exceedsLimit) {
        return null;
    }
    return (React.createElement(Tooltip, { theme: "error", content: React.createElement("div", null,
            "A minimum evaluation interval of",
            ' ',
            React.createElement("span", { className: styles.globalLimitValue }, config.unifiedAlerting.minInterval),
            " has been configured in Grafana and will be used instead of the ",
            rule.group.interval,
            " interval configured for the Rule Group.") },
        React.createElement(Icon, { name: "stopwatch-slash", className: styles.icon })));
}
function getStyles(theme) {
    return {
        globalLimitValue: css `
      font-weight: ${theme.typography.fontWeightBold};
    `,
        icon: css `
      fill: ${theme.colors.warning.text};
    `,
    };
}
//# sourceMappingURL=RuleConfigStatus.js.map