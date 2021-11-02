import { __assign, __makeTemplateObject, __rest } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { Field, Input, InputControl, Select, useStyles } from '@grafana/ui';
import { useFormContext } from 'react-hook-form';
import { RuleFormType } from '../../types/rule-form';
import { timeOptions } from '../../utils/time';
import { RuleEditorSection } from './RuleEditorSection';
import { PreviewRule } from './PreviewRule';
export var CloudConditionsStep = function () {
    var _a, _b;
    var styles = useStyles(getStyles);
    var _c = useFormContext(), register = _c.register, control = _c.control, watch = _c.watch, errors = _c.formState.errors;
    var type = watch('type');
    // cloud recording rules do not have alert conditions
    if (type === RuleFormType.cloudRecording) {
        return null;
    }
    return (React.createElement(RuleEditorSection, { stepNo: 3, title: "Define alert conditions" },
        React.createElement(Field, { label: "For", description: "Expression has to be true for this long for the alert to be fired." },
            React.createElement("div", { className: styles.flexRow },
                React.createElement(Field, { invalid: !!((_a = errors.forTime) === null || _a === void 0 ? void 0 : _a.message), error: (_b = errors.forTime) === null || _b === void 0 ? void 0 : _b.message, className: styles.inlineField },
                    React.createElement(Input, __assign({}, register('forTime', { pattern: { value: /^\d+$/, message: 'Must be a positive integer.' } }), { width: 8 }))),
                React.createElement(InputControl, { name: "forTimeUnit", render: function (_a) {
                        var _b = _a.field, onChange = _b.onChange, ref = _b.ref, field = __rest(_b, ["onChange", "ref"]);
                        return (React.createElement(Select, __assign({ menuShouldPortal: true }, field, { options: timeOptions, onChange: function (value) { return onChange(value === null || value === void 0 ? void 0 : value.value); }, width: 15, className: styles.timeUnit })));
                    }, control: control }))),
        React.createElement(PreviewRule, null)));
};
var getStyles = function (theme) { return ({
    inlineField: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin-bottom: 0;\n  "], ["\n    margin-bottom: 0;\n  "]))),
    flexRow: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    display: flex;\n    flex-direction: row;\n    justify-content: flex-start;\n    align-items: flex-start;\n  "], ["\n    display: flex;\n    flex-direction: row;\n    justify-content: flex-start;\n    align-items: flex-start;\n  "]))),
    timeUnit: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    margin-left: ", ";\n  "], ["\n    margin-left: ", ";\n  "])), theme.spacing.xs),
}); };
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=CloudConditionsStep.js.map