import { __assign, __read, __spreadArray } from "tslib";
import React, { useMemo } from 'react';
import { MultiSelect } from '@grafana/ui';
import { labelsToGroupedOptions } from '../functions';
import { SYSTEM_LABELS, INPUT_WIDTH } from '../constants';
import { Aggregation, QueryEditorRow } from '.';
export var GroupBy = function (_a) {
    var _b, _c;
    var _d = _a.labels, groupBys = _d === void 0 ? [] : _d, query = _a.query, onChange = _a.onChange, variableOptionGroup = _a.variableOptionGroup, metricDescriptor = _a.metricDescriptor;
    var options = useMemo(function () { return __spreadArray([variableOptionGroup], __read(labelsToGroupedOptions(__spreadArray(__spreadArray([], __read(groupBys), false), __read(SYSTEM_LABELS), false))), false); }, [
        groupBys,
        variableOptionGroup,
    ]);
    return (React.createElement(QueryEditorRow, { label: "Group by", tooltip: "You can reduce the amount of data returned for a metric by combining different time series. To combine multiple time series, you can specify a grouping and a function. Grouping is done on the basis of labels. The grouping function is used to combine the time series in the group into a single time series." },
        React.createElement(MultiSelect, { menuShouldPortal: true, width: INPUT_WIDTH, placeholder: "Choose label", options: options, value: (_b = query.groupBys) !== null && _b !== void 0 ? _b : [], onChange: function (options) {
                onChange(__assign(__assign({}, query), { groupBys: options.map(function (o) { return o.value; }) }));
            } }),
        React.createElement(Aggregation, { metricDescriptor: metricDescriptor, templateVariableOptions: variableOptionGroup.options, crossSeriesReducer: query.crossSeriesReducer, groupBys: (_c = query.groupBys) !== null && _c !== void 0 ? _c : [], onChange: function (crossSeriesReducer) { return onChange(__assign(__assign({}, query), { crossSeriesReducer: crossSeriesReducer })); } })));
};
//# sourceMappingURL=GroupBy.js.map