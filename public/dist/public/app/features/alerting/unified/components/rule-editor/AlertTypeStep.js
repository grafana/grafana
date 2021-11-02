import { __assign, __makeTemplateObject, __rest } from "tslib";
import React, { useMemo } from 'react';
import { Field, Input, InputControl, Select, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { RuleEditorSection } from './RuleEditorSection';
import { useFormContext } from 'react-hook-form';
import { RuleFormType } from '../../types/rule-form';
import { RuleFolderPicker } from './RuleFolderPicker';
import { GroupAndNamespaceFields } from './GroupAndNamespaceFields';
import { contextSrv } from 'app/core/services/context_srv';
import { CloudRulesSourcePicker } from './CloudRulesSourcePicker';
var recordingRuleNameValidationPattern = {
    message: 'Recording rule name must be valid metric name. It may only contain letters, numbers, and colons. It may not contain whitespace.',
    value: /^[a-zA-Z_:][a-zA-Z0-9_:]*$/,
};
export var AlertTypeStep = function (_a) {
    var _b, _c, _d, _e, _f, _g, _h, _j;
    var editingExistingRule = _a.editingExistingRule;
    var styles = useStyles2(getStyles);
    var _k = useFormContext(), register = _k.register, control = _k.control, watch = _k.watch, errors = _k.formState.errors, setValue = _k.setValue;
    var ruleFormType = watch('type');
    var dataSourceName = watch('dataSourceName');
    var alertTypeOptions = useMemo(function () {
        var result = [
            {
                label: 'Grafana managed alert',
                value: RuleFormType.grafana,
                description: 'Classic Grafana alerts based on thresholds.',
            },
        ];
        if (contextSrv.isEditor) {
            result.push({
                label: 'Cortex/Loki managed alert',
                value: RuleFormType.cloudAlerting,
                description: 'Alert based on a system or application behavior. Based on Prometheus.',
            });
            result.push({
                label: 'Cortex/Loki managed recording rule',
                value: RuleFormType.cloudRecording,
                description: 'Recording rule to pre-compute frequently needed or expensive calculations. Based on Prometheus.',
            });
        }
        return result;
    }, []);
    return (React.createElement(RuleEditorSection, { stepNo: 1, title: "Rule type" },
        React.createElement(Field, { className: styles.formInput, label: "Rule name", error: (_b = errors === null || errors === void 0 ? void 0 : errors.name) === null || _b === void 0 ? void 0 : _b.message, invalid: !!((_c = errors.name) === null || _c === void 0 ? void 0 : _c.message) },
            React.createElement(Input, __assign({ id: "name" }, register('name', {
                required: { value: true, message: 'Must enter an alert name' },
                pattern: ruleFormType === RuleFormType.cloudRecording ? recordingRuleNameValidationPattern : undefined,
            }), { autoFocus: true }))),
        React.createElement("div", { className: styles.flexRow },
            React.createElement(Field, { disabled: editingExistingRule, label: "Rule type", className: styles.formInput, error: (_d = errors.type) === null || _d === void 0 ? void 0 : _d.message, invalid: !!((_e = errors.type) === null || _e === void 0 ? void 0 : _e.message), "data-testid": "alert-type-picker" },
                React.createElement(InputControl, { render: function (_a) {
                        var _b = _a.field, onChange = _b.onChange, ref = _b.ref, field = __rest(_b, ["onChange", "ref"]);
                        return (React.createElement(Select, __assign({ menuShouldPortal: true }, field, { options: alertTypeOptions, onChange: function (v) { return onChange(v === null || v === void 0 ? void 0 : v.value); } })));
                    }, name: "type", control: control, rules: {
                        required: { value: true, message: 'Please select alert type' },
                    } })),
            (ruleFormType === RuleFormType.cloudRecording || ruleFormType === RuleFormType.cloudAlerting) && (React.createElement(Field, { className: styles.formInput, label: "Select data source", error: (_f = errors.dataSourceName) === null || _f === void 0 ? void 0 : _f.message, invalid: !!((_g = errors.dataSourceName) === null || _g === void 0 ? void 0 : _g.message), "data-testid": "datasource-picker" },
                React.createElement(InputControl, { render: function (_a) {
                        var _b = _a.field, onChange = _b.onChange, ref = _b.ref, field = __rest(_b, ["onChange", "ref"]);
                        return (React.createElement(CloudRulesSourcePicker, __assign({}, field, { onChange: function (ds) {
                                var _a;
                                // reset location if switching data sources, as different rules source will have different groups and namespaces
                                setValue('location', undefined);
                                onChange((_a = ds === null || ds === void 0 ? void 0 : ds.name) !== null && _a !== void 0 ? _a : null);
                            } })));
                    }, name: "dataSourceName", control: control, rules: {
                        required: { value: true, message: 'Please select a data source' },
                    } })))),
        (ruleFormType === RuleFormType.cloudRecording || ruleFormType === RuleFormType.cloudAlerting) &&
            dataSourceName && React.createElement(GroupAndNamespaceFields, { rulesSourceName: dataSourceName }),
        ruleFormType === RuleFormType.grafana && (React.createElement(Field, { label: "Folder", className: styles.formInput, error: (_h = errors.folder) === null || _h === void 0 ? void 0 : _h.message, invalid: !!((_j = errors.folder) === null || _j === void 0 ? void 0 : _j.message), "data-testid": "folder-picker" },
            React.createElement(InputControl, { render: function (_a) {
                    var _b = _a.field, ref = _b.ref, field = __rest(_b, ["ref"]);
                    return (React.createElement(RuleFolderPicker, __assign({}, field, { enableCreateNew: true, enableReset: true })));
                }, name: "folder", rules: {
                    required: { value: true, message: 'Please select a folder' },
                } })))));
};
var getStyles = function (theme) { return ({
    formInput: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    width: 330px;\n    & + & {\n      margin-left: ", ";\n    }\n  "], ["\n    width: 330px;\n    & + & {\n      margin-left: ", ";\n    }\n  "])), theme.spacing(3)),
    flexRow: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    display: flex;\n    flex-direction: row;\n    justify-content: flex-start;\n  "], ["\n    display: flex;\n    flex-direction: row;\n    justify-content: flex-start;\n  "]))),
}); };
var templateObject_1, templateObject_2;
//# sourceMappingURL=AlertTypeStep.js.map