import { css, cx } from '@emotion/css';
import React, { useState } from 'react';
import { AccessoryButton, InputGroup } from '@grafana/experimental';
import { Input, stylesFactory, useTheme2 } from '@grafana/ui';
export const MultiFilterItem = ({ filter, onChange, onDelete, keyPlaceholder }) => {
    var _a;
    const [localKey, setLocalKey] = useState(filter.key || '');
    const [localValue, setLocalValue] = useState(((_a = filter.value) === null || _a === void 0 ? void 0 : _a.join(', ')) || '');
    const theme = useTheme2();
    const styles = getOperatorStyles(theme);
    return (React.createElement("div", { "data-testid": "cloudwatch-multifilter-item" },
        React.createElement(InputGroup, null,
            React.createElement(Input, { "data-testid": "cloudwatch-multifilter-item-key", "aria-label": "Filter key", value: localKey, placeholder: keyPlaceholder !== null && keyPlaceholder !== void 0 ? keyPlaceholder : 'key', onChange: (e) => setLocalKey(e.currentTarget.value), onBlur: () => {
                    if (localKey && localKey !== filter.key) {
                        onChange(Object.assign(Object.assign({}, filter), { key: localKey }));
                    }
                } }),
            React.createElement("span", { className: cx(styles.root) }, "="),
            React.createElement(Input, { "data-testid": "cloudwatch-multifilter-item-value", "aria-label": "Filter value", value: localValue, placeholder: "value1, value2,...", onChange: (e) => setLocalValue(e.currentTarget.value), onBlur: () => {
                    const newValues = localValue.split(',').map((v) => v.trim());
                    if (localValue && newValues !== filter.value) {
                        onChange(Object.assign(Object.assign({}, filter), { value: newValues }));
                    }
                    setLocalValue(newValues.join(', '));
                } }),
            React.createElement(AccessoryButton, { "aria-label": "remove", icon: "times", variant: "secondary", onClick: onDelete, type: "button" }))));
};
const getOperatorStyles = stylesFactory((theme) => ({
    root: css({
        padding: theme.spacing(0, 1),
        alignSelf: 'center',
    }),
}));
//# sourceMappingURL=MultiFilterItem.js.map