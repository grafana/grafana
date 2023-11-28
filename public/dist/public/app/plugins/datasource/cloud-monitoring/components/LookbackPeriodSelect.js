import React from 'react';
import { EditorField } from '@grafana/experimental';
import { Select } from '@grafana/ui';
import { LOOKBACK_PERIODS } from '../constants';
export const LookbackPeriodSelect = ({ refId, current, templateVariableOptions, onChange }) => {
    const options = LOOKBACK_PERIODS.map((lp) => (Object.assign(Object.assign({}, lp), { label: lp.text })));
    if (current && !options.find((op) => op.value === current)) {
        options.push({ label: current, text: current, value: current, hidden: false });
    }
    const visibleOptions = options.filter((lp) => !lp.hidden);
    return (React.createElement(EditorField, { label: "Lookback period", htmlFor: `${refId}-lookback-period` },
        React.createElement(Select, { inputId: `${refId}-lookback-period`, width: "auto", allowCustomValue: true, value: [...options, ...templateVariableOptions].find((s) => s.value === current), options: [
                {
                    label: 'Template Variables',
                    options: templateVariableOptions,
                },
                {
                    label: 'Predefined periods',
                    expanded: true,
                    options: visibleOptions,
                },
            ], onChange: ({ value }) => onChange(value) })));
};
//# sourceMappingURL=LookbackPeriodSelect.js.map