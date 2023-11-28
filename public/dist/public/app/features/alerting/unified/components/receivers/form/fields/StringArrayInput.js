import { css } from '@emotion/css';
import React from 'react';
import { Button, Input, useStyles2 } from '@grafana/ui';
import { ActionIcon } from '../../../rules/ActionIcon';
export const StringArrayInput = ({ value, onChange, readOnly = false }) => {
    const styles = useStyles2(getStyles);
    const deleteItem = (index) => {
        if (!value) {
            return;
        }
        const newValue = value.slice();
        newValue.splice(index, 1);
        onChange(newValue);
    };
    const updateValue = (itemValue, index) => {
        if (!value) {
            return;
        }
        onChange(value.map((v, i) => (i === index ? itemValue : v)));
    };
    return (React.createElement("div", null,
        !!(value === null || value === void 0 ? void 0 : value.length) &&
            value.map((v, index) => (React.createElement("div", { key: index, className: styles.row },
                React.createElement(Input, { readOnly: readOnly, value: v, onChange: (e) => updateValue(e.currentTarget.value, index) }),
                !readOnly && (React.createElement(ActionIcon, { className: styles.deleteIcon, icon: "trash-alt", tooltip: "delete", onClick: () => deleteItem(index) }))))),
        !readOnly && (React.createElement(Button, { className: styles.addButton, type: "button", variant: "secondary", icon: "plus", size: "sm", onClick: () => onChange([...(value !== null && value !== void 0 ? value : []), '']) }, "Add"))));
};
const getStyles = (theme) => ({
    row: css `
    display: flex;
    flex-direction: row;
    margin-bottom: ${theme.spacing(1)};
    align-items: center;
  `,
    deleteIcon: css `
    margin-left: ${theme.spacing(1)};
  `,
    addButton: css `
    margin-top: ${theme.spacing(1)};
  `,
});
//# sourceMappingURL=StringArrayInput.js.map