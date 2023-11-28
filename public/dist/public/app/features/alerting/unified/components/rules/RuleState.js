import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import { intervalToAbbreviatedDurationString } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Spinner, useStyles2 } from '@grafana/ui';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';
import { isAlertingRule, isRecordingRule, getFirstActiveAt } from '../../utils/rules';
import { AlertStateTag } from './AlertStateTag';
export const RuleState = ({ rule, isDeleting, isCreating, isPaused }) => {
    const style = useStyles2(getStyle);
    const { promRule } = rule;
    // return how long the rule has been in its firing state, if any
    const forTime = useMemo(() => {
        var _a;
        if (promRule &&
            isAlertingRule(promRule) &&
            ((_a = promRule.alerts) === null || _a === void 0 ? void 0 : _a.length) &&
            promRule.state !== PromAlertingRuleState.Inactive) {
            // find earliest alert
            const firstActiveAt = promRule.activeAt ? new Date(promRule.activeAt) : getFirstActiveAt(promRule);
            // calculate time elapsed from earliest alert
            if (firstActiveAt) {
                return (React.createElement("span", { title: String(firstActiveAt), className: style.for },
                    "for",
                    ' ',
                    intervalToAbbreviatedDurationString({
                        start: firstActiveAt,
                        end: new Date(),
                    }, false)));
            }
        }
        return null;
    }, [promRule, style]);
    if (isDeleting) {
        return (React.createElement(Stack, { gap: 1 },
            React.createElement(Spinner, null),
            "Deleting"));
    }
    else if (isCreating) {
        return (React.createElement(Stack, { gap: 1 },
            React.createElement(Spinner, null),
            "Creating"));
    }
    else if (promRule && isAlertingRule(promRule)) {
        return (React.createElement(Stack, { gap: 1 },
            React.createElement(AlertStateTag, { state: promRule.state, isPaused: isPaused }),
            forTime));
    }
    else if (promRule && isRecordingRule(promRule)) {
        return React.createElement(React.Fragment, null, "Recording rule");
    }
    return React.createElement(React.Fragment, null, "n/a");
};
const getStyle = (theme) => ({
    for: css `
    font-size: ${theme.typography.bodySmall.fontSize};
    color: ${theme.colors.text.secondary};
    white-space: nowrap;
    padding-top: 2px;
  `,
});
//# sourceMappingURL=RuleState.js.map