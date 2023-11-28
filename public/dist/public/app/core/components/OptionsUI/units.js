import { css } from '@emotion/css';
import React from 'react';
import { IconButton, UnitPicker, useStyles2 } from '@grafana/ui';
export function UnitValueEditor({ value, onChange, item }) {
    var _a;
    const styles = useStyles2(getStyles);
    if (((_a = item === null || item === void 0 ? void 0 : item.settings) === null || _a === void 0 ? void 0 : _a.isClearable) && value != null) {
        return (React.createElement("div", { className: styles.wrapper },
            React.createElement("span", { className: styles.first },
                React.createElement(UnitPicker, { value: value, onChange: onChange })),
            React.createElement(IconButton, { name: "times", onClick: () => onChange(undefined), tooltip: "Clear unit selection" })));
    }
    return React.createElement(UnitPicker, { value: value, onChange: onChange });
}
const getStyles = (theme) => ({
    wrapper: css `
    width: 100%;
    display: flex;
    flex-direction: rows;
    align-items: center;
  `,
    first: css `
    margin-right: 8px;
    flex-grow: 2;
  `,
});
//# sourceMappingURL=units.js.map