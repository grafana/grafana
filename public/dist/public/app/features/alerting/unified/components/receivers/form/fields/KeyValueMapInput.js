import { __makeTemplateObject, __read, __spreadArray, __values } from "tslib";
import React, { useEffect, useState } from 'react';
import { css } from '@emotion/css';
import { Button, Input, useStyles2 } from '@grafana/ui';
import { ActionIcon } from '../../../rules/ActionIcon';
export var KeyValueMapInput = function (_a) {
    var value = _a.value, onChange = _a.onChange, _b = _a.readOnly, readOnly = _b === void 0 ? false : _b;
    var styles = useStyles2(getStyles);
    var _c = __read(useState(recordToPairs(value)), 2), pairs = _c[0], setPairs = _c[1];
    useEffect(function () { return setPairs(recordToPairs(value)); }, [value]);
    var emitChange = function (pairs) {
        onChange(pairsToRecord(pairs));
    };
    var deleteItem = function (index) {
        var newPairs = pairs.slice();
        var removed = newPairs.splice(index, 1)[0];
        setPairs(newPairs);
        if (removed[0]) {
            emitChange(newPairs);
        }
    };
    var updatePair = function (values, index) {
        var old = pairs[index];
        var newPairs = pairs.map(function (pair, i) { return (i === index ? values : pair); });
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
            React.createElement("tbody", null, pairs.map(function (_a, index) {
                var _b = __read(_a, 2), key = _b[0], value = _b[1];
                return (React.createElement("tr", { key: index },
                    React.createElement("td", null,
                        React.createElement(Input, { readOnly: readOnly, value: key, onChange: function (e) { return updatePair([e.currentTarget.value, value], index); } })),
                    React.createElement("td", null,
                        React.createElement(Input, { readOnly: readOnly, value: value, onChange: function (e) { return updatePair([key, e.currentTarget.value], index); } })),
                    !readOnly && (React.createElement("td", null,
                        React.createElement(ActionIcon, { icon: "trash-alt", tooltip: "delete", onClick: function () { return deleteItem(index); } })))));
            })))),
        !readOnly && (React.createElement(Button, { className: styles.addButton, type: "button", variant: "secondary", icon: "plus", size: "sm", onClick: function () { return setPairs(__spreadArray(__spreadArray([], __read(pairs), false), [['', '']], false)); } }, "Add"))));
};
var getStyles = function (theme) { return ({
    addButton: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin-top: ", ";\n  "], ["\n    margin-top: ", ";\n  "])), theme.spacing(1)),
    table: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    tbody td {\n      padding: 0 ", " ", " 0;\n    }\n  "], ["\n    tbody td {\n      padding: 0 ", " ", " 0;\n    }\n  "])), theme.spacing(1), theme.spacing(1)),
}); };
var pairsToRecord = function (pairs) {
    var e_1, _a;
    var record = {};
    try {
        for (var pairs_1 = __values(pairs), pairs_1_1 = pairs_1.next(); !pairs_1_1.done; pairs_1_1 = pairs_1.next()) {
            var _b = __read(pairs_1_1.value, 2), key = _b[0], value = _b[1];
            if (key) {
                record[key] = value;
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (pairs_1_1 && !pairs_1_1.done && (_a = pairs_1.return)) _a.call(pairs_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return record;
};
var recordToPairs = function (obj) { return Object.entries(obj !== null && obj !== void 0 ? obj : {}); };
var templateObject_1, templateObject_2;
//# sourceMappingURL=KeyValueMapInput.js.map