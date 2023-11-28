import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Input, Select } from '@grafana/ui';
export const SelectWithAdd = ({ value, onChange, options, className, placeholder, width, custom, onCustomChange, disabled = false, addLabel = '+ Add new', 'aria-label': ariaLabel, getOptionLabel, }) => {
    const [isCustom, setIsCustom] = useState(custom);
    useEffect(() => {
        setIsCustom(custom);
    }, [custom]);
    const _options = useMemo(() => [...options, { value: '__add__', label: addLabel }], [options, addLabel]);
    const inputRef = useRef(null);
    useEffect(() => {
        if (inputRef.current && isCustom) {
            inputRef.current.focus();
        }
    }, [isCustom]);
    if (isCustom) {
        return (React.createElement(Input, { "aria-label": ariaLabel, width: width, autoFocus: !custom, value: value || '', placeholder: placeholder, className: className, disabled: disabled, ref: inputRef, onChange: (e) => onChange(e.currentTarget.value) }));
    }
    else {
        return (React.createElement(Select, { "aria-label": ariaLabel, width: width, options: _options, value: value, className: className, placeholder: placeholder, getOptionLabel: getOptionLabel, disabled: disabled, onChange: (val) => {
                const value = val === null || val === void 0 ? void 0 : val.value;
                if (value === '__add__') {
                    setIsCustom(true);
                    if (onCustomChange) {
                        onCustomChange(true);
                    }
                    onChange('');
                }
                else {
                    onChange(value);
                }
            } }));
    }
};
//# sourceMappingURL=SelectWIthAdd.js.map