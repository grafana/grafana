import { __makeTemplateObject } from "tslib";
import { css } from '@emotion/css';
import { intervalToAbbreviatedDurationString } from '@grafana/data';
import { HorizontalGroup, Spinner, useStyles2 } from '@grafana/ui';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';
import React, { useMemo } from 'react';
import { isAlertingRule, isRecordingRule, getFirstActiveAt } from '../../utils/rules';
import { AlertStateTag } from './AlertStateTag';
export var RuleState = function (_a) {
    var rule = _a.rule, isDeleting = _a.isDeleting, isCreating = _a.isCreating;
    var style = useStyles2(getStyle);
    var promRule = rule.promRule;
    // return how long the rule has been in it's firing state, if any
    var forTime = useMemo(function () {
        var _a;
        if (promRule &&
            isAlertingRule(promRule) &&
            ((_a = promRule.alerts) === null || _a === void 0 ? void 0 : _a.length) &&
            promRule.state !== PromAlertingRuleState.Inactive) {
            // find earliest alert
            var firstActiveAt = getFirstActiveAt(promRule);
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
        return (React.createElement(HorizontalGroup, { align: "flex-start" },
            React.createElement(Spinner, null),
            "deleting"));
    }
    else if (isCreating) {
        return (React.createElement(HorizontalGroup, { align: "flex-start" },
            ' ',
            React.createElement(Spinner, null),
            "creating"));
    }
    else if (promRule && isAlertingRule(promRule)) {
        return (React.createElement(HorizontalGroup, { align: "flex-start" },
            React.createElement(AlertStateTag, { state: promRule.state }),
            forTime));
    }
    else if (promRule && isRecordingRule(promRule)) {
        return React.createElement(React.Fragment, null, "Recording rule");
    }
    return React.createElement(React.Fragment, null, "n/a");
};
var getStyle = function (theme) { return ({
    for: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    font-size: ", ";\n    color: ", ";\n    white-space: nowrap;\n    padding-top: 2px;\n  "], ["\n    font-size: ", ";\n    color: ", ";\n    white-space: nowrap;\n    padding-top: 2px;\n  "])), theme.typography.bodySmall.fontSize, theme.colors.text.secondary),
}); };
var templateObject_1;
//# sourceMappingURL=RuleState.js.map