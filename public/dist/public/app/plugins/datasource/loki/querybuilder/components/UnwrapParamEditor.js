import { __awaiter } from "tslib";
import React, { useState } from 'react';
import { toOption } from '@grafana/data';
import { Select } from '@grafana/ui';
import { getOperationParamId } from '../../../prometheus/querybuilder/shared/operationUtils';
import { placeHolderScopedVars } from '../../components/monaco-query-field/monaco-completion-provider/validation';
import { LokiDatasource } from '../../datasource';
import { getLogQueryFromMetricsQuery, isQueryWithError } from '../../queryUtils';
import { extractUnwrapLabelKeysFromDataFrame } from '../../responseUtils';
import { lokiQueryModeller } from '../LokiQueryModeller';
export function UnwrapParamEditor({ onChange, index, operationId, value, query, datasource, }) {
    const [state, setState] = useState({});
    return (React.createElement(Select, { inputId: getOperationParamId(operationId, index), onOpenMenu: () => __awaiter(this, void 0, void 0, function* () {
            // This check is always true, we do it to make typescript happy
            if (datasource instanceof LokiDatasource) {
                setState({ isLoading: true });
                const options = yield loadUnwrapOptions(query, datasource);
                setState({ options, isLoading: undefined });
            }
        }), isLoading: state.isLoading, allowCustomValue: true, noOptionsMessage: "No labels found", loadingMessage: "Loading labels", options: state.options, value: value ? toOption(value.toString()) : null, onChange: (value) => {
            if (value.value) {
                onChange(index, value.value);
            }
        } }));
}
function loadUnwrapOptions(query, datasource) {
    return __awaiter(this, void 0, void 0, function* () {
        const queryExpr = lokiQueryModeller.renderQuery(query);
        const logExpr = getLogQueryFromMetricsQuery(queryExpr);
        if (isQueryWithError(datasource.interpolateString(logExpr, placeHolderScopedVars))) {
            return [];
        }
        const samples = yield datasource.getDataSamples({ expr: logExpr, refId: 'unwrap_samples' });
        const unwrapLabels = extractUnwrapLabelKeysFromDataFrame(samples[0]);
        const labelOptions = unwrapLabels.map((label) => ({
            label,
            value: label,
        }));
        return labelOptions;
    });
}
//# sourceMappingURL=UnwrapParamEditor.js.map