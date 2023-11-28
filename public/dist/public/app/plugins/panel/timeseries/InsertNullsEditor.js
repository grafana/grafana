import React from 'react';
import { HorizontalGroup, RadioButtonGroup } from '@grafana/ui';
import { InputPrefix, NullsThresholdInput } from './NullsThresholdInput';
const DISCONNECT_OPTIONS = [
    {
        label: 'Never',
        value: false,
    },
    {
        label: 'Threshold',
        value: 3600000, // 1h
    },
];
export const InsertNullsEditor = ({ value, onChange, item }) => {
    const isThreshold = typeof value === 'number';
    DISCONNECT_OPTIONS[1].value = isThreshold ? value : 3600000; // 1h
    return (React.createElement(HorizontalGroup, null,
        React.createElement(RadioButtonGroup, { value: value, options: DISCONNECT_OPTIONS, onChange: onChange }),
        isThreshold && (React.createElement(NullsThresholdInput, { value: value, onChange: onChange, inputPrefix: InputPrefix.GreaterThan, isTime: item.settings.isTime }))));
};
//# sourceMappingURL=InsertNullsEditor.js.map