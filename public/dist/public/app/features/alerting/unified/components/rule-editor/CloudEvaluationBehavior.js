import { __rest } from "tslib";
import { css } from '@emotion/css';
import React from 'react';
import { useFormContext } from 'react-hook-form';
import { Field, Input, InputControl, Select, useStyles2 } from '@grafana/ui';
import { RuleFormType } from '../../types/rule-form';
import { timeOptions } from '../../utils/time';
import { GroupAndNamespaceFields } from './GroupAndNamespaceFields';
import { PreviewRule } from './PreviewRule';
import { RuleEditorSection } from './RuleEditorSection';
export const CloudEvaluationBehavior = () => {
    var _a, _b;
    const styles = useStyles2(getStyles);
    const { register, control, watch, formState: { errors }, } = useFormContext();
    const type = watch('type');
    const dataSourceName = watch('dataSourceName');
    return (React.createElement(RuleEditorSection, { stepNo: 3, title: "Set evaluation behavior" },
        React.createElement(Field, { label: "Pending period", description: "Period in which an alert rule can be in breach of the condition until the alert rule fires." },
            React.createElement("div", { className: styles.flexRow },
                React.createElement(Field, { invalid: !!((_a = errors.forTime) === null || _a === void 0 ? void 0 : _a.message), error: (_b = errors.forTime) === null || _b === void 0 ? void 0 : _b.message, className: styles.inlineField },
                    React.createElement(Input, Object.assign({}, register('forTime', { pattern: { value: /^\d+$/, message: 'Must be a positive integer.' } }), { width: 8 }))),
                React.createElement(InputControl, { name: "forTimeUnit", render: (_a) => {
                        var _b = _a.field, { onChange, ref } = _b, field = __rest(_b, ["onChange", "ref"]);
                        return (React.createElement(Select, Object.assign({}, field, { options: timeOptions, onChange: (value) => onChange(value === null || value === void 0 ? void 0 : value.value), width: 15, className: styles.timeUnit })));
                    }, control: control }))),
        type === RuleFormType.cloudAlerting && dataSourceName && (React.createElement(GroupAndNamespaceFields, { rulesSourceName: dataSourceName })),
        React.createElement(PreviewRule, null)));
};
const getStyles = (theme) => ({
    inlineField: css `
    margin-bottom: 0;
  `,
    flexRow: css `
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    align-items: flex-start;
  `,
    timeUnit: css `
    margin-left: ${theme.spacing(0.5)};
  `,
});
//# sourceMappingURL=CloudEvaluationBehavior.js.map