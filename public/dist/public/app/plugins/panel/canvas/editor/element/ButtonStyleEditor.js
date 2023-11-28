import React, { useCallback } from 'react';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';
import { defaultStyleConfig } from 'app/features/canvas/elements/button';
const variantOptions = [
    { label: 'primary', value: 'primary' },
    { label: 'secondary', value: 'secondary' },
    { label: 'success', value: 'success' },
    { label: 'destructive', value: 'destructive' },
];
export const ButtonStyleEditor = ({ value, onChange }) => {
    if (!value) {
        value = defaultStyleConfig;
    }
    const onVariantChange = useCallback((variant) => {
        var _a;
        onChange(Object.assign(Object.assign({}, value), { variant: (_a = variant === null || variant === void 0 ? void 0 : variant.value) !== null && _a !== void 0 ? _a : defaultStyleConfig.variant }));
    }, [onChange, value]);
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Variant", grow: true },
                React.createElement(Select, { options: variantOptions, value: value === null || value === void 0 ? void 0 : value.variant, onChange: onVariantChange })))));
};
//# sourceMappingURL=ButtonStyleEditor.js.map