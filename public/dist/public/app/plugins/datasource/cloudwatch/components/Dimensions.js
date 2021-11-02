import { __assign, __read, __rest, __spreadArray } from "tslib";
import React, { Fragment, useState, useEffect } from 'react';
import { isEqual } from 'lodash';
import { SegmentAsync, Icon } from '@grafana/ui';
var removeText = '-- remove dimension --';
var removeOption = { label: removeText, value: removeText };
// The idea of this component is that is should only trigger the onChange event in the case
// there is a complete dimension object. E.g, when a new key is added is doesn't have a value.
// That should not trigger onChange.
export var Dimensions = function (_a) {
    var dimensions = _a.dimensions, loadValues = _a.loadValues, loadKeys = _a.loadKeys, onChange = _a.onChange;
    var _b = __read(useState(dimensions), 2), data = _b[0], setData = _b[1];
    useEffect(function () {
        var completeDimensions = Object.entries(data).reduce(function (res, _a) {
            var _b;
            var _c = __read(_a, 2), key = _c[0], value = _c[1];
            return (value ? __assign(__assign({}, res), (_b = {}, _b[key] = value, _b)) : res);
        }, {});
        if (!isEqual(completeDimensions, dimensions)) {
            onChange(completeDimensions);
        }
    }, [data, dimensions, onChange]);
    var excludeUsedKeys = function (options) {
        return options.filter(function (_a) {
            var value = _a.value;
            return !Object.keys(data).includes(value);
        });
    };
    return (React.createElement(React.Fragment, null,
        Object.entries(data).map(function (_a, index) {
            var _b = __read(_a, 2), key = _b[0], value = _b[1];
            return (React.createElement(Fragment, { key: index },
                React.createElement(SegmentAsync, { allowCustomValue: true, value: key, loadOptions: function () { return loadKeys().then(function (keys) { return __spreadArray([removeOption], __read(excludeUsedKeys(keys)), false); }); }, onChange: function (_a) {
                        var _b;
                        var newKey = _a.value;
                        var _c = data, _d = key, value = _c[_d], newDimensions = __rest(_c, [typeof _d === "symbol" ? _d : _d + ""]);
                        if (newKey === removeText) {
                            setData(__assign({}, newDimensions));
                        }
                        else {
                            setData(__assign(__assign({}, newDimensions), (_b = {}, _b[newKey] = '', _b)));
                        }
                    } }),
                React.createElement("label", { className: "gf-form-label query-segment-operator" }, "="),
                React.createElement(SegmentAsync, { allowCustomValue: true, value: value, placeholder: "select dimension value", loadOptions: function () { return loadValues(key); }, onChange: function (_a) {
                        var _b;
                        var newValue = _a.value;
                        return setData(__assign(__assign({}, data), (_b = {}, _b[key] = newValue, _b)));
                    } }),
                Object.values(data).length > 1 && index + 1 !== Object.values(data).length && (React.createElement("label", { className: "gf-form-label query-keyword" }, "AND"))));
        }),
        Object.values(data).every(function (v) { return v; }) && (React.createElement(SegmentAsync, { allowCustomValue: true, Component: React.createElement("a", { className: "gf-form-label query-part" },
                React.createElement(Icon, { name: "plus" })), loadOptions: function () { return loadKeys().then(excludeUsedKeys); }, onChange: function (_a) {
                var _b;
                var newKey = _a.value;
                return setData(__assign(__assign({}, data), (_b = {}, _b[newKey] = '', _b)));
            } }))));
};
//# sourceMappingURL=Dimensions.js.map