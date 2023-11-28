import React from 'react';
import { HorizontalGroup, RadioButtonGroup } from '@grafana/ui';
import { InputPrefix, NullsThresholdInput } from './NullsThresholdInput';
const GAPS_OPTIONS = [
    {
        label: 'Never',
        value: false,
    },
    {
        label: 'Always',
        value: true,
    },
    {
        label: 'Threshold',
        value: 3600000, // 1h
    },
];
export const SpanNullsEditor = ({ value, onChange, item }) => {
    const isThreshold = typeof value === 'number';
    GAPS_OPTIONS[2].value = isThreshold ? value : 3600000; // 1h
    return (React.createElement(HorizontalGroup, null,
        React.createElement(RadioButtonGroup, { value: value, options: GAPS_OPTIONS, onChange: onChange }),
        isThreshold && (React.createElement(NullsThresholdInput, { value: value, onChange: onChange, inputPrefix: InputPrefix.LessThan, isTime: item.settings.isTime }))));
};
//# sourceMappingURL=SpanNullsEditor.js.map