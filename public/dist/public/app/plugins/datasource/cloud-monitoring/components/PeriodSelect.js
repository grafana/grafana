import React, { useMemo } from 'react';
import { Select } from '@grafana/ui';
export function PeriodSelect({ inputId, templateVariableOptions, onChange, current, disabled, aligmentPeriods, }) {
    const options = useMemo(() => aligmentPeriods.map((ap) => (Object.assign(Object.assign({}, ap), { label: ap.text }))), [aligmentPeriods]);
    const visibleOptions = useMemo(() => options.filter((ap) => !ap.hidden), [options]);
    return (React.createElement(Select, { width: "auto", onChange: ({ value }) => onChange(value), value: [...options, ...templateVariableOptions].find((s) => s.value === current), options: [
            {
                label: 'Template Variables',
                options: templateVariableOptions,
            },
            {
                label: 'Aggregations',
                expanded: true,
                options: visibleOptions,
            },
        ], placeholder: "Select Period", inputId: inputId, disabled: disabled, allowCustomValue: true, menuPlacement: "top" }));
}
//# sourceMappingURL=PeriodSelect.js.map