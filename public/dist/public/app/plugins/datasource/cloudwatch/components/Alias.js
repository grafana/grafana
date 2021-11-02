import { __read } from "tslib";
import React, { useState } from 'react';
import { debounce } from 'lodash';
import { LegacyForms } from '@grafana/ui';
var Input = LegacyForms.Input;
export var Alias = function (_a) {
    var _b = _a.value, value = _b === void 0 ? '' : _b, onChange = _a.onChange;
    var _c = __read(useState(value), 2), alias = _c[0], setAlias = _c[1];
    var propagateOnChange = debounce(onChange, 1500);
    onChange = function (e) {
        setAlias(e.target.value);
        propagateOnChange(e.target.value);
    };
    return React.createElement(Input, { type: "text", className: "gf-form-input width-16", value: alias, onChange: onChange });
};
//# sourceMappingURL=Alias.js.map