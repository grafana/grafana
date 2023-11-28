import { __awaiter } from "tslib";
import React, { useState } from 'react';
import { toOption } from '@grafana/data';
import { Select } from '@grafana/ui';
import { promQueryModeller } from '../PromQueryModeller';
import { getOperationParamId } from '../shared/operationUtils';
export function LabelParamEditor({ onChange, index, operationId, value, query, datasource, }) {
    const [state, setState] = useState({});
    return (React.createElement(Select, { inputId: getOperationParamId(operationId, index), autoFocus: value === '' ? true : undefined, openMenuOnFocus: true, onOpenMenu: () => __awaiter(this, void 0, void 0, function* () {
            setState({ isLoading: true });
            const options = yield loadGroupByLabels(query, datasource);
            setState({ options, isLoading: undefined });
        }), isLoading: state.isLoading, allowCustomValue: true, noOptionsMessage: "No labels found", loadingMessage: "Loading labels", options: state.options, value: toOption(value), onChange: (value) => onChange(index, value.value) }));
}
function loadGroupByLabels(query, datasource) {
    return __awaiter(this, void 0, void 0, function* () {
        let labels = query.labels;
        // This function is used by both Prometheus and Loki and this the only difference.
        if (datasource.type === 'prometheus') {
            labels = [{ label: '__name__', op: '=', value: query.metric }, ...query.labels];
        }
        const expr = promQueryModeller.renderLabels(labels);
        const result = yield datasource.languageProvider.fetchSeriesLabels(expr);
        return Object.keys(result).map((x) => ({
            label: x,
            value: x,
        }));
    });
}
//# sourceMappingURL=LabelParamEditor.js.map