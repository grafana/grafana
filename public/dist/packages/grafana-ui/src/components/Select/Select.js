import { __assign } from "tslib";
import React from 'react';
import { SelectBase } from './SelectBase';
export function Select(props) {
    return React.createElement(SelectBase, __assign({}, props));
}
export function MultiSelect(props) {
    // @ts-ignore
    return React.createElement(SelectBase, __assign({}, props, { isMulti: true }));
}
export function AsyncSelect(props) {
    return React.createElement(SelectBase, __assign({}, props));
}
export function AsyncMultiSelect(props) {
    // @ts-ignore
    return React.createElement(SelectBase, __assign({}, props, { isMulti: true }));
}
//# sourceMappingURL=Select.js.map