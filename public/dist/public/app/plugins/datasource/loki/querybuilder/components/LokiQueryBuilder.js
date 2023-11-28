import { __awaiter } from "tslib";
import React, { useEffect, useMemo, useState } from 'react';
import { getDefaultTimeRange, LoadingState } from '@grafana/data';
import { EditorRow } from '@grafana/experimental';
import { LabelFilters } from 'app/plugins/datasource/prometheus/querybuilder/shared/LabelFilters';
import { OperationExplainedBox } from 'app/plugins/datasource/prometheus/querybuilder/shared/OperationExplainedBox';
import { OperationList } from 'app/plugins/datasource/prometheus/querybuilder/shared/OperationList';
import { OperationListExplained } from 'app/plugins/datasource/prometheus/querybuilder/shared/OperationListExplained';
import { OperationsEditorRow } from 'app/plugins/datasource/prometheus/querybuilder/shared/OperationsEditorRow';
import { QueryBuilderHints } from 'app/plugins/datasource/prometheus/querybuilder/shared/QueryBuilderHints';
import { RawQuery } from 'app/plugins/datasource/prometheus/querybuilder/shared/RawQuery';
import { testIds } from '../../components/LokiQueryEditor';
import { escapeLabelValueInSelector } from '../../languageUtils';
import logqlGrammar from '../../syntax';
import { lokiQueryModeller } from '../LokiQueryModeller';
import { buildVisualQueryFromString } from '../parsing';
import { LokiOperationId } from '../types';
import { EXPLAIN_LABEL_FILTER_CONTENT } from './LokiQueryBuilderExplained';
import { NestedQueryList } from './NestedQueryList';
export const LokiQueryBuilder = React.memo(({ datasource, query, onChange, onRunQuery, showExplain }) => {
    const [sampleData, setSampleData] = useState();
    const [highlightedOp, setHighlightedOp] = useState(undefined);
    const onChangeLabels = (labels) => {
        onChange(Object.assign(Object.assign({}, query), { labels }));
    };
    const withTemplateVariableOptions = (optionsPromise) => __awaiter(void 0, void 0, void 0, function* () {
        const options = yield optionsPromise;
        return [...datasource.getVariables(), ...options].map((value) => ({ label: value, value }));
    });
    const onGetLabelNames = (forLabel) => __awaiter(void 0, void 0, void 0, function* () {
        const labelsToConsider = query.labels.filter((x) => x !== forLabel);
        if (labelsToConsider.length === 0) {
            return yield datasource.languageProvider.fetchLabels();
        }
        const expr = lokiQueryModeller.renderLabels(labelsToConsider);
        const series = yield datasource.languageProvider.fetchSeriesLabels(expr);
        const labelsNamesToConsider = labelsToConsider.map((l) => l.label);
        const labelNames = Object.keys(series)
            // Filter out label names that are already selected
            .filter((name) => !labelsNamesToConsider.includes(name))
            .sort();
        return labelNames;
    });
    const onGetLabelValues = (forLabel) => __awaiter(void 0, void 0, void 0, function* () {
        if (!forLabel.label) {
            return [];
        }
        let values;
        const labelsToConsider = query.labels.filter((x) => x !== forLabel);
        if (labelsToConsider.length === 0) {
            values = yield datasource.languageProvider.fetchLabelValues(forLabel.label);
        }
        else {
            const expr = lokiQueryModeller.renderLabels(labelsToConsider);
            const result = yield datasource.languageProvider.fetchSeriesLabels(expr);
            values = result[datasource.interpolateString(forLabel.label)];
        }
        return values ? values.map((v) => escapeLabelValueInSelector(v, forLabel.op)) : []; // Escape values in return
    });
    const labelFilterRequired = useMemo(() => {
        const { labels, operations: op } = query;
        if (!labels.length && op.length) {
            // Filter is required when operations are present (empty line contains operation is exception)
            if (op.length === 1 && op[0].id === LokiOperationId.LineContains && op[0].params[0] === '') {
                return false;
            }
            return true;
        }
        return false;
    }, [query]);
    useEffect(() => {
        const onGetSampleData = () => __awaiter(void 0, void 0, void 0, function* () {
            const lokiQuery = { expr: lokiQueryModeller.renderQuery(query), refId: 'data-samples' };
            const series = yield datasource.getDataSamples(lokiQuery);
            const sampleData = { series, state: LoadingState.Done, timeRange: getDefaultTimeRange() };
            setSampleData(sampleData);
        });
        onGetSampleData().catch(console.error);
    }, [datasource, query]);
    const lang = { grammar: logqlGrammar, name: 'logql' };
    return (React.createElement("div", { "data-testid": testIds.editor },
        React.createElement(EditorRow, null,
            React.createElement(LabelFilters, { onGetLabelNames: (forLabel) => withTemplateVariableOptions(onGetLabelNames(forLabel)), onGetLabelValues: (forLabel) => withTemplateVariableOptions(onGetLabelValues(forLabel)), labelsFilters: query.labels, onChange: onChangeLabels, labelFilterRequired: labelFilterRequired })),
        showExplain && (React.createElement(OperationExplainedBox, { stepNumber: 1, title: React.createElement(RawQuery, { query: `${lokiQueryModeller.renderLabels(query.labels)}`, lang: lang }) }, EXPLAIN_LABEL_FILTER_CONTENT)),
        React.createElement(OperationsEditorRow, null,
            React.createElement(OperationList, { queryModeller: lokiQueryModeller, query: query, onChange: onChange, onRunQuery: onRunQuery, datasource: datasource, highlightedOp: highlightedOp }),
            React.createElement(QueryBuilderHints, { datasource: datasource, query: query, onChange: onChange, data: sampleData, queryModeller: lokiQueryModeller, buildVisualQueryFromString: buildVisualQueryFromString })),
        showExplain && (React.createElement(OperationListExplained, { stepNumber: 2, queryModeller: lokiQueryModeller, query: query, lang: lang, onMouseEnter: (op) => {
                setHighlightedOp(op);
            }, onMouseLeave: () => {
                setHighlightedOp(undefined);
            } })),
        query.binaryQueries && query.binaryQueries.length > 0 && (React.createElement(NestedQueryList, { query: query, datasource: datasource, onChange: onChange, onRunQuery: onRunQuery, showExplain: showExplain }))));
});
LokiQueryBuilder.displayName = 'LokiQueryBuilder';
//# sourceMappingURL=LokiQueryBuilder.js.map