import React, { useMemo } from 'react';
import { EditorField, EditorFieldGroup } from '@grafana/experimental';
import { MultiSelect } from '@grafana/ui';
import { SYSTEM_LABELS } from '../constants';
import { labelsToGroupedOptions } from '../functions';
import { Aggregation } from './Aggregation';
export const GroupBy = ({ refId, labels: groupBys = [], query, onChange, variableOptionGroup, metricDescriptor, }) => {
    var _a, _b;
    const options = useMemo(() => [variableOptionGroup, ...labelsToGroupedOptions([...groupBys, ...SYSTEM_LABELS])], [groupBys, variableOptionGroup]);
    return (React.createElement(EditorFieldGroup, null,
        React.createElement(EditorField, { label: "Group by", tooltip: "You can reduce the amount of data returned for a metric by combining different time series. To combine multiple time series, you can specify a grouping and a function. Grouping is done on the basis of labels. The grouping function is used to combine the time series in the group into a single time series." },
            React.createElement(MultiSelect, { inputId: `${refId}-group-by`, width: "auto", placeholder: "Choose label", options: options, value: (_a = query.groupBys) !== null && _a !== void 0 ? _a : [], onChange: (options) => {
                    onChange(Object.assign(Object.assign({}, query), { groupBys: options.map((o) => o.value) }));
                }, menuPlacement: "top" })),
        React.createElement(Aggregation, { metricDescriptor: metricDescriptor, templateVariableOptions: variableOptionGroup.options, crossSeriesReducer: query.crossSeriesReducer, groupBys: (_b = query.groupBys) !== null && _b !== void 0 ? _b : [], onChange: (crossSeriesReducer) => onChange(Object.assign(Object.assign({}, query), { crossSeriesReducer })), refId: refId })));
};
//# sourceMappingURL=GroupBy.js.map