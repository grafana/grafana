import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { Button, Input, useStyles2 } from '@grafana/ui';
import { ActionIcon } from '../../../rules/ActionIcon';
export const KeyValueMapInput = ({ value, onChange, readOnly = false }) => {
    const styles = useStyles2(getStyles);
    const [pairs, setPairs] = useState(recordToPairs(value));
    useEffect(() => setPairs(recordToPairs(value)), [value]);
    const emitChange = (pairs) => {
        onChange(pairsToRecord(pairs));
    };
    const deleteItem = (index) => {
        const newPairs = pairs.slice();
        const removed = newPairs.splice(index, 1)[0];
        setPairs(newPairs);
        if (removed[0]) {
            emitChange(newPairs);
        }
    };
    const updatePair = (values, index) => {
        const old = pairs[index];
        const newPairs = pairs.map((pair, i) => (i === index ? values : pair));
        setPairs(newPairs);
        if (values[0] || old[0]) {
            emitChange(newPairs);
        }
    };
    return (React.createElement("div", null,
        !!pairs.length && (React.createElement("table", { className: styles.table },
            React.createElement("thead", null,
                React.createElement("tr", null,
                    React.createElement("th", null, "Name"),
                    React.createElement("th", null, "Value"),
                    !readOnly && React.createElement("th", null))),
            React.createElement("tbody", null, pairs.map(([key, value], index) => (React.createElement("tr", { key: index },
                React.createElement("td", null,
                    React.createElement(Input, { readOnly: readOnly, value: key, onChange: (e) => updatePair([e.currentTarget.value, value], index) })),
                React.createElement("td", null,
                    React.createElement(Input, { readOnly: readOnly, value: value, onChange: (e) => updatePair([key, e.currentTarget.value], index) })),
                !readOnly && (React.createElement("td", null,
                    React.createElement(ActionIcon, { icon: "trash-alt", tooltip: "delete", onClick: () => deleteItem(index) }))))))))),
        !readOnly && (React.createElement(Button, { className: styles.addButton, type: "button", variant: "secondary", icon: "plus", size: "sm", onClick: () => setPairs([...pairs, ['', '']]) }, "Add"))));
};
const getStyles = (theme) => ({
    addButton: css `
    margin-top: ${theme.spacing(1)};
  `,
    table: css `
    tbody td {
      padding: 0 ${theme.spacing(1)} ${theme.spacing(1)} 0;
    }
  `,
});
const pairsToRecord = (pairs) => {
    const record = {};
    for (const [key, value] of pairs) {
        if (key) {
            record[key] = value;
        }
    }
    return record;
};
const recordToPairs = (obj) => Object.entries(obj !== null && obj !== void 0 ? obj : {});
//# sourceMappingURL=KeyValueMapInput.js.map