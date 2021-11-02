import { __assign, __makeTemplateObject, __read, __rest } from "tslib";
import React, { useState } from 'react';
import { css } from '@emotion/css';
import { parseDuration, durationToMilliseconds } from '@grafana/data';
import { Field, InlineLabel, Input, InputControl, useStyles2 } from '@grafana/ui';
import { useFormContext } from 'react-hook-form';
import { positiveDurationValidationPattern, durationValidationPattern } from '../../utils/time';
import { ConditionField } from './ConditionField';
import { GrafanaAlertStatePicker } from './GrafanaAlertStatePicker';
import { RuleEditorSection } from './RuleEditorSection';
import { PreviewRule } from './PreviewRule';
import { GrafanaConditionEvalWarning } from './GrafanaConditionEvalWarning';
import { CollapseToggle } from '../CollapseToggle';
var MIN_TIME_RANGE_STEP_S = 10; // 10 seconds
var forValidationOptions = {
    required: {
        value: true,
        message: 'Required.',
    },
    pattern: durationValidationPattern,
};
var evaluateEveryValidationOptions = {
    required: {
        value: true,
        message: 'Required.',
    },
    pattern: positiveDurationValidationPattern,
    validate: function (value) {
        var duration = parseDuration(value);
        if (Object.keys(duration).length) {
            var diff = durationToMilliseconds(duration);
            if (diff < MIN_TIME_RANGE_STEP_S * 1000) {
                return "Cannot be less than " + MIN_TIME_RANGE_STEP_S + " seconds.";
            }
            if (diff % (MIN_TIME_RANGE_STEP_S * 1000) !== 0) {
                return "Must be a multiple of " + MIN_TIME_RANGE_STEP_S + " seconds.";
            }
        }
        return true;
    },
};
export var GrafanaConditionsStep = function () {
    var _a, _b, _c, _d;
    var styles = useStyles2(getStyles);
    var _e = __read(useState(false), 2), showErrorHandling = _e[0], setShowErrorHandling = _e[1];
    var _f = useFormContext(), register = _f.register, errors = _f.formState.errors;
    return (React.createElement(RuleEditorSection, { stepNo: 3, title: "Define alert conditions" },
        React.createElement(ConditionField, null),
        React.createElement(Field, { label: "Evaluate" },
            React.createElement("div", { className: styles.flexRow },
                React.createElement(InlineLabel, { width: 16, tooltip: "How often the alert will be evaluated to see if it fires" }, "Evaluate every"),
                React.createElement(Field, { className: styles.inlineField, error: (_a = errors.evaluateEvery) === null || _a === void 0 ? void 0 : _a.message, invalid: !!((_b = errors.evaluateEvery) === null || _b === void 0 ? void 0 : _b.message), validationMessageHorizontalOverflow: true },
                    React.createElement(Input, __assign({ width: 8 }, register('evaluateEvery', evaluateEveryValidationOptions)))),
                React.createElement(InlineLabel, { width: 7, tooltip: 'Once condition is breached, alert will go into pending state. If it is pending for longer than the "for" value, it will become a firing alert.' }, "for"),
                React.createElement(Field, { className: styles.inlineField, error: (_c = errors.evaluateFor) === null || _c === void 0 ? void 0 : _c.message, invalid: !!((_d = errors.evaluateFor) === null || _d === void 0 ? void 0 : _d.message), validationMessageHorizontalOverflow: true },
                    React.createElement(Input, __assign({ width: 8 }, register('evaluateFor', forValidationOptions)))))),
        React.createElement(GrafanaConditionEvalWarning, null),
        React.createElement(CollapseToggle, { isCollapsed: !showErrorHandling, onToggle: function (collapsed) { return setShowErrorHandling(!collapsed); }, text: "Configure no data and error handling", className: styles.collapseToggle }),
        showErrorHandling && (React.createElement(React.Fragment, null,
            React.createElement(Field, { label: "Alert state if no data or all values are null" },
                React.createElement(InputControl, { render: function (_a) {
                        var _b = _a.field, onChange = _b.onChange, ref = _b.ref, field = __rest(_b, ["onChange", "ref"]);
                        return (React.createElement(GrafanaAlertStatePicker, __assign({}, field, { width: 42, includeNoData: true, onChange: function (value) { return onChange(value === null || value === void 0 ? void 0 : value.value); } })));
                    }, name: "noDataState" })),
            React.createElement(Field, { label: "Alert state if execution error or timeout" },
                React.createElement(InputControl, { render: function (_a) {
                        var _b = _a.field, onChange = _b.onChange, ref = _b.ref, field = __rest(_b, ["onChange", "ref"]);
                        return (React.createElement(GrafanaAlertStatePicker, __assign({}, field, { width: 42, includeNoData: false, onChange: function (value) { return onChange(value === null || value === void 0 ? void 0 : value.value); } })));
                    }, name: "execErrState" })))),
        React.createElement(PreviewRule, null)));
};
var getStyles = function (theme) { return ({
    inlineField: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin-bottom: 0;\n  "], ["\n    margin-bottom: 0;\n  "]))),
    flexRow: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    display: flex;\n    flex-direction: row;\n    justify-content: flex-start;\n    align-items: flex-start;\n  "], ["\n    display: flex;\n    flex-direction: row;\n    justify-content: flex-start;\n    align-items: flex-start;\n  "]))),
    collapseToggle: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    margin: ", ";\n  "], ["\n    margin: ", ";\n  "])), theme.spacing(2, 0, 2, -1)),
}); };
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=GrafanaConditionsStep.js.map