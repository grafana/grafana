import React from 'react';
import { useFormContext } from 'react-hook-form';
import { Field, Input, Text } from '@grafana/ui';
import { RuleFormType } from '../../types/rule-form';
import { RuleEditorSection } from './RuleEditorSection';
const recordingRuleNameValidationPattern = {
    message: 'Recording rule name must be valid metric name. It may only contain letters, numbers, and colons. It may not contain whitespace.',
    value: /^[a-zA-Z_:][a-zA-Z0-9_:]*$/,
};
export const AlertRuleNameInput = () => {
    var _a, _b;
    const { register, watch, formState: { errors }, } = useFormContext();
    const ruleFormType = watch('type');
    const entityName = ruleFormType === RuleFormType.cloudRecording ? 'recording rule' : 'alert rule';
    return (React.createElement(RuleEditorSection, { stepNo: 1, title: `Enter ${entityName} name`, description: React.createElement(Text, { variant: "bodySmall", color: "secondary" },
            "Enter a name to identify your ",
            entityName,
            ".") },
        React.createElement(Field, { label: "Name", error: (_a = errors === null || errors === void 0 ? void 0 : errors.name) === null || _a === void 0 ? void 0 : _a.message, invalid: !!((_b = errors.name) === null || _b === void 0 ? void 0 : _b.message) },
            React.createElement(Input, Object.assign({ id: "name", width: 35 }, register('name', {
                required: { value: true, message: 'Must enter a name' },
                pattern: ruleFormType === RuleFormType.cloudRecording ? recordingRuleNameValidationPattern : undefined,
            }), { "aria-label": "name", placeholder: `Give your ${entityName} a name` })))));
};
//# sourceMappingURL=AlertRuleNameInput.js.map