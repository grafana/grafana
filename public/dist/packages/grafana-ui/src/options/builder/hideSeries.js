import { __assign } from "tslib";
import React, { useCallback } from 'react';
import { startCase } from 'lodash';
import { FilterPill, HorizontalGroup } from '../../index';
var SeriesConfigEditor = function (props) {
    var value = props.value, onChange = props.onChange;
    var onChangeToggle = useCallback(function (prop) {
        var _a;
        onChange(__assign(__assign({}, value), (_a = {}, _a[prop] = !value[prop], _a)));
    }, [value, onChange]);
    return (React.createElement(HorizontalGroup, { spacing: "xs" }, Object.keys(value).map(function (k) {
        var key = k;
        return (React.createElement(FilterPill, { icon: value[key] ? 'eye-slash' : 'eye', onClick: function () { return onChangeToggle(key); }, key: key, label: startCase(key), selected: value[key] }));
    })));
};
/**
 * @alpha
 */
export function addHideFrom(builder) {
    builder.addCustomEditor({
        id: 'hideFrom',
        name: 'Hide in area',
        category: ['Series'],
        path: 'hideFrom',
        defaultValue: {
            tooltip: false,
            viz: false,
            legend: false,
        },
        editor: SeriesConfigEditor,
        override: SeriesConfigEditor,
        shouldApply: function () { return true; },
        hideFromDefaults: true,
        process: function (value) { return value; },
    });
}
//# sourceMappingURL=hideSeries.js.map