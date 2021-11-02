import { __assign, __read, __spreadArray } from "tslib";
import React, { useMemo } from 'react';
import { Select } from '@grafana/ui';
import { ALIGNMENT_PERIODS } from '../constants';
export function AlignmentPeriod(_a) {
    var templateVariableOptions = _a.templateVariableOptions, onChange = _a.onChange, query = _a.query, selectWidth = _a.selectWidth;
    var options = useMemo(function () {
        return ALIGNMENT_PERIODS.map(function (ap) { return (__assign(__assign({}, ap), { label: ap.text })); });
    }, []);
    var visibleOptions = useMemo(function () { return options.filter(function (ap) { return !ap.hidden; }); }, [options]);
    return (React.createElement(Select, { menuShouldPortal: true, width: selectWidth, onChange: function (_a) {
            var value = _a.value;
            return onChange(__assign(__assign({}, query), { alignmentPeriod: value }));
        }, value: __spreadArray(__spreadArray([], __read(options), false), __read(templateVariableOptions), false).find(function (s) { return s.value === query.alignmentPeriod; }), options: [
            {
                label: 'Template Variables',
                options: templateVariableOptions,
            },
            {
                label: 'Aggregations',
                expanded: true,
                options: visibleOptions,
            },
        ], placeholder: "Select Alignment" }));
}
//# sourceMappingURL=AlignmentPeriod.js.map