import React, { useCallback } from 'react';
import { NumberInput } from './NumberInput';
export const NumberValueEditor = ({ value, onChange, item }) => {
    const { settings } = item;
    const onValueChange = useCallback((value) => {
        onChange((settings === null || settings === void 0 ? void 0 : settings.integer) && value !== undefined ? Math.floor(value) : value);
    }, [onChange, settings === null || settings === void 0 ? void 0 : settings.integer]);
    return (React.createElement(NumberInput, { value: value, min: settings === null || settings === void 0 ? void 0 : settings.min, max: settings === null || settings === void 0 ? void 0 : settings.max, step: settings === null || settings === void 0 ? void 0 : settings.step, placeholder: settings === null || settings === void 0 ? void 0 : settings.placeholder, onChange: onValueChange }));
};
//# sourceMappingURL=number.js.map