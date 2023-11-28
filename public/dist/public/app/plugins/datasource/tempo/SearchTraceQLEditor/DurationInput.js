import { css } from '@emotion/css';
import React from 'react';
import { Select, HorizontalGroup, Input, useStyles2 } from '@grafana/ui';
import { operatorSelectableValue } from './utils';
// Support template variables (e.g., `$dur`, `$v_1`) and durations (e.g., `300µs`, `1.2ms`)
const validationRegex = /^(\$\w+)|(\d+(?:\.\d)?\d*(?:us|µs|ns|ms|s|m|h))$/;
const getStyles = () => ({
    noBoxShadow: css `
    box-shadow: none;
    *:focus {
      box-shadow: none;
    }
  `,
});
const DurationInput = ({ filter, operators, updateFilter }) => {
    const styles = useStyles2(getStyles);
    let invalid = false;
    if (typeof filter.value === 'string') {
        invalid = filter.value ? !validationRegex.test(filter.value.concat('')) : false;
    }
    return (React.createElement(HorizontalGroup, { spacing: 'none' },
        React.createElement(Select, { className: styles.noBoxShadow, inputId: `${filter.id}-operator`, options: operators.map(operatorSelectableValue), value: filter.operator, onChange: (v) => {
                updateFilter(Object.assign(Object.assign({}, filter), { operator: v === null || v === void 0 ? void 0 : v.value }));
            }, isClearable: false, "aria-label": `select ${filter.id} operator`, allowCustomValue: true, width: 8 }),
        React.createElement(Input, { className: styles.noBoxShadow, value: filter.value, onChange: (v) => {
                updateFilter(Object.assign(Object.assign({}, filter), { value: v.currentTarget.value }));
            }, placeholder: "e.g. 100ms, 1.2s", "aria-label": `select ${filter.id} value`, invalid: invalid, width: 18 })));
};
export default DurationInput;
//# sourceMappingURL=DurationInput.js.map