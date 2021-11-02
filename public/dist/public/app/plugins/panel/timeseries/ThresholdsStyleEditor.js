import React, { useCallback } from 'react';
import { Select } from '@grafana/ui';
export var ThresholdsStyleEditor = function (_a) {
    var item = _a.item, value = _a.value, onChange = _a.onChange, id = _a.id;
    var onChangeCb = useCallback(function (v) {
        onChange({
            mode: v.value,
        });
    }, [onChange]);
    return (React.createElement(Select, { inputId: id, menuShouldPortal: true, value: value.mode, options: item.settings.options, onChange: onChangeCb }));
};
//# sourceMappingURL=ThresholdsStyleEditor.js.map