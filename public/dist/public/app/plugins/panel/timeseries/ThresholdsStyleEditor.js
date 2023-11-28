import React, { useCallback } from 'react';
import { Select } from '@grafana/ui';
export const ThresholdsStyleEditor = ({ item, value, onChange, id }) => {
    const onChangeCb = useCallback((v) => {
        onChange({
            mode: v.value,
        });
    }, [onChange]);
    return React.createElement(Select, { inputId: id, value: value.mode, options: item.settings.options, onChange: onChangeCb });
};
//# sourceMappingURL=ThresholdsStyleEditor.js.map