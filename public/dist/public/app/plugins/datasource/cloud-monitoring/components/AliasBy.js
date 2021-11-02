import { __read } from "tslib";
import React, { useState } from 'react';
import { debounce } from 'lodash';
import { Input } from '@grafana/ui';
import { QueryEditorRow } from '.';
import { INPUT_WIDTH } from '../constants';
export var AliasBy = function (_a) {
    var _b = _a.value, value = _b === void 0 ? '' : _b, onChange = _a.onChange;
    var _c = __read(useState(value !== null && value !== void 0 ? value : ''), 2), alias = _c[0], setAlias = _c[1];
    var propagateOnChange = debounce(onChange, 1000);
    onChange = function (e) {
        setAlias(e.target.value);
        propagateOnChange(e.target.value);
    };
    return (React.createElement(QueryEditorRow, { label: "Alias by" },
        React.createElement(Input, { width: INPUT_WIDTH, value: alias, onChange: onChange })));
};
//# sourceMappingURL=AliasBy.js.map