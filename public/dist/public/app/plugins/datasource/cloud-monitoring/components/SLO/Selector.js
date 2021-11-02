import { __assign, __read, __spreadArray } from "tslib";
import React from 'react';
import { Select } from '@grafana/ui';
import { QueryEditorRow } from '..';
import { SELECT_WIDTH, SELECTORS } from '../../constants';
export var Selector = function (_a) {
    var query = _a.query, templateVariableOptions = _a.templateVariableOptions, onChange = _a.onChange, datasource = _a.datasource;
    return (React.createElement(QueryEditorRow, { label: "Selector" },
        React.createElement(Select, { menuShouldPortal: true, width: SELECT_WIDTH, allowCustomValue: true, value: __spreadArray(__spreadArray([], __read(SELECTORS), false), __read(templateVariableOptions), false).find(function (s) { var _a; return (_a = s.value === (query === null || query === void 0 ? void 0 : query.selectorName)) !== null && _a !== void 0 ? _a : ''; }), options: __spreadArray([
                {
                    label: 'Template Variables',
                    options: templateVariableOptions,
                }
            ], __read(SELECTORS), false), onChange: function (_a) {
                var selectorName = _a.value;
                return onChange(__assign(__assign({}, query), { selectorName: selectorName !== null && selectorName !== void 0 ? selectorName : '' }));
            } })));
};
//# sourceMappingURL=Selector.js.map