import { __assign, __read, __spreadArray } from "tslib";
import React from 'react';
import { Segment } from '@grafana/ui';
import { QueryType } from '../types';
import { QUERY_TYPES } from '../constants';
function asQueryType(input) {
    var res = [];
    input.forEach(function (v) {
        if (v.value === QueryType.METRICS) {
            res.push(__assign(__assign({}, v), { value: QueryType.METRICS }));
        }
        if (v.value === QueryType.SLO) {
            res.push(__assign(__assign({}, v), { value: QueryType.SLO }));
        }
    });
    return res;
}
export var QueryTypeSelector = function (_a) {
    var onChange = _a.onChange, value = _a.value, templateVariableOptions = _a.templateVariableOptions;
    return (React.createElement("div", { className: "gf-form-inline" },
        React.createElement("label", { className: "gf-form-label query-keyword width-9" }, "Query Type"),
        React.createElement(Segment, { value: __spreadArray(__spreadArray([], __read(QUERY_TYPES), false), __read(asQueryType(templateVariableOptions)), false).find(function (qt) { return qt.value === value; }), options: __spreadArray(__spreadArray([], __read(QUERY_TYPES), false), [
                {
                    label: 'Template Variables',
                    options: templateVariableOptions,
                },
            ], false), onChange: function (_a) {
                var value = _a.value;
                return onChange(value);
            } }),
        React.createElement("div", { className: "gf-form gf-form--grow" },
            React.createElement("label", { className: "gf-form-label gf-form-label--grow" }))));
};
//# sourceMappingURL=QueryType.js.map