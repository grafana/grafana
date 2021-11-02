import { __assign, __read, __spreadArray } from "tslib";
import React, { useMemo } from 'react';
import { Select } from '@grafana/ui';
import { getAlignmentPickerData } from '../functions';
import { SELECT_WIDTH } from '../constants';
export var AlignmentFunction = function (_a) {
    var query = _a.query, templateVariableOptions = _a.templateVariableOptions, onChange = _a.onChange;
    var valueType = query.valueType, metricKind = query.metricKind, psa = query.perSeriesAligner, preprocessor = query.preprocessor;
    var _b = useMemo(function () { return getAlignmentPickerData(valueType, metricKind, psa, preprocessor); }, [valueType, metricKind, psa, preprocessor]), perSeriesAligner = _b.perSeriesAligner, alignOptions = _b.alignOptions;
    return (React.createElement(Select, { menuShouldPortal: true, width: SELECT_WIDTH, onChange: function (_a) {
            var value = _a.value;
            return onChange(__assign(__assign({}, query), { perSeriesAligner: value }));
        }, value: __spreadArray(__spreadArray([], __read(alignOptions), false), __read(templateVariableOptions), false).find(function (s) { return s.value === perSeriesAligner; }), options: [
            {
                label: 'Template Variables',
                options: templateVariableOptions,
            },
            {
                label: 'Alignment options',
                expanded: true,
                options: alignOptions,
            },
        ], placeholder: "Select Alignment" }));
};
//# sourceMappingURL=AlignmentFunction.js.map