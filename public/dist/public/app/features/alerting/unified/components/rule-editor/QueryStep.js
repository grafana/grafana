import { __assign, __rest } from "tslib";
import React from 'react';
import { useFormContext } from 'react-hook-form';
import { Field, InputControl } from '@grafana/ui';
import { ExpressionEditor } from './ExpressionEditor';
import { RuleEditorSection } from './RuleEditorSection';
import { RuleFormType } from '../../types/rule-form';
import { QueryEditor } from './QueryEditor';
export var QueryStep = function () {
    var _a, _b;
    var _c = useFormContext(), control = _c.control, watch = _c.watch, errors = _c.formState.errors;
    var type = watch('type');
    var dataSourceName = watch('dataSourceName');
    return (React.createElement(RuleEditorSection, { stepNo: 2, title: type === RuleFormType.cloudRecording ? 'Create a query to be recorded' : 'Create a query to be alerted on' },
        (type === RuleFormType.cloudRecording || type === RuleFormType.cloudAlerting) && dataSourceName && (React.createElement(Field, { error: (_a = errors.expression) === null || _a === void 0 ? void 0 : _a.message, invalid: !!((_b = errors.expression) === null || _b === void 0 ? void 0 : _b.message) },
            React.createElement(InputControl, { name: "expression", render: function (_a) {
                    var _b = _a.field, ref = _b.ref, field = __rest(_b, ["ref"]);
                    return React.createElement(ExpressionEditor, __assign({}, field, { dataSourceName: dataSourceName }));
                }, control: control, rules: {
                    required: { value: true, message: 'A valid expression is required' },
                } }))),
        type === RuleFormType.grafana && (React.createElement(Field, { invalid: !!errors.queries, error: (!!errors.queries && 'Must provide at least one valid query.') || undefined },
            React.createElement(InputControl, { name: "queries", render: function (_a) {
                    var _b = _a.field, ref = _b.ref, field = __rest(_b, ["ref"]);
                    return React.createElement(QueryEditor, __assign({}, field));
                }, control: control, rules: {
                    validate: function (queries) { return Array.isArray(queries) && !!queries.length; },
                } })))));
};
//# sourceMappingURL=QueryStep.js.map