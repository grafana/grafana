import { useState } from 'react';
const hasValue = (searchValue) => ({ value }) => value === searchValue;
const getInitialState = (initialOptions, initialValue) => {
    if (initialValue === undefined || initialOptions.some(hasValue(initialValue))) {
        return initialOptions;
    }
    return [
        ...initialOptions,
        {
            value: initialValue,
            label: initialValue,
        },
    ];
};
/**
 * Creates the Props needed by Select to handle custom values and handles custom value creation
 * and the initial value when it is not present in the option array.
 */
export const useCreatableSelectPersistedBehaviour = ({ options: initialOptions, value, onChange }) => {
    const [options, setOptions] = useState(getInitialState(initialOptions, value));
    const addOption = (newValue) => setOptions([...options, { value: newValue, label: newValue }]);
    return {
        onCreateOption: (value) => {
            addOption(value);
            onChange({ value });
        },
        onChange,
        allowCustomValue: true,
        options,
        value,
    };
};
//# sourceMappingURL=useCreatableSelectPersistedBehaviour.js.map