import { __assign, __read, __spreadArray } from "tslib";
import React, { useMemo } from 'react';
import { RadioButtonGroup } from '@grafana/ui';
import { MetricKind, PreprocessorType, ValueTypes } from '../types';
import { getAlignmentPickerData } from '../functions';
import { QueryEditorRow } from '.';
var NONE_OPTION = { label: 'None', value: PreprocessorType.None };
export var Preprocessor = function (_a) {
    var _b;
    var query = _a.query, metricDescriptor = _a.metricDescriptor, onChange = _a.onChange;
    var options = useOptions(metricDescriptor);
    return (React.createElement(QueryEditorRow, { label: "Pre-processing", tooltip: "Preprocessing options are displayed when the selected metric has a metric kind of delta or cumulative. The specific options available are determined by the metic's value type. If you select 'Rate', data points are aligned and converted to a rate per time series. If you select 'Delta', data points are aligned by their delta (difference) per time series" },
        React.createElement(RadioButtonGroup, { onChange: function (value) {
                var valueType = query.valueType, metricKind = query.metricKind, psa = query.perSeriesAligner;
                var perSeriesAligner = getAlignmentPickerData(valueType, metricKind, psa, value).perSeriesAligner;
                onChange(__assign(__assign({}, query), { preprocessor: value, perSeriesAligner: perSeriesAligner }));
            }, value: (_b = query.preprocessor) !== null && _b !== void 0 ? _b : PreprocessorType.None, options: options })));
};
var useOptions = function (metricDescriptor) {
    var metricKind = metricDescriptor === null || metricDescriptor === void 0 ? void 0 : metricDescriptor.metricKind;
    var valueType = metricDescriptor === null || metricDescriptor === void 0 ? void 0 : metricDescriptor.valueType;
    return useMemo(function () {
        if (!metricKind || metricKind === MetricKind.GAUGE || valueType === ValueTypes.DISTRIBUTION) {
            return [NONE_OPTION];
        }
        var options = [
            NONE_OPTION,
            {
                label: 'Rate',
                value: PreprocessorType.Rate,
                description: 'Data points are aligned and converted to a rate per time series',
            },
        ];
        return metricKind === MetricKind.CUMULATIVE
            ? __spreadArray(__spreadArray([], __read(options), false), [
                {
                    label: 'Delta',
                    value: PreprocessorType.Delta,
                    description: 'Data points are aligned by their delta (difference) per time series',
                },
            ], false) : options;
    }, [metricKind, valueType]);
};
//# sourceMappingURL=Preprocessor.js.map