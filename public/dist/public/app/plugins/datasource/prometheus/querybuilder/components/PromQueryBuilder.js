import React, { useState } from 'react';
import { EditorRow } from '@grafana/experimental';
import promqlGrammar from '../../promql';
import { promQueryModeller } from '../PromQueryModeller';
import { buildVisualQueryFromString } from '../parsing';
import { OperationExplainedBox } from '../shared/OperationExplainedBox';
import { OperationList } from '../shared/OperationList';
import { OperationListExplained } from '../shared/OperationListExplained';
import { OperationsEditorRow } from '../shared/OperationsEditorRow';
import { QueryBuilderHints } from '../shared/QueryBuilderHints';
import { RawQuery } from '../shared/RawQuery';
import { MetricsLabelsSection } from './MetricsLabelsSection';
import { NestedQueryList } from './NestedQueryList';
import { EXPLAIN_LABEL_FILTER_CONTENT } from './PromQueryBuilderExplained';
export const PromQueryBuilder = React.memo((props) => {
    const { datasource, query, onChange, onRunQuery, data, showExplain } = props;
    const [highlightedOp, setHighlightedOp] = useState();
    const lang = { grammar: promqlGrammar, name: 'promql' };
    const initHints = datasource.getInitHints();
    return (React.createElement(React.Fragment, null,
        React.createElement(EditorRow, null,
            React.createElement(MetricsLabelsSection, { query: query, onChange: onChange, datasource: datasource })),
        initHints.length ? (React.createElement("div", { className: "query-row-break" },
            React.createElement("div", { className: "prom-query-field-info text-warning" },
                initHints[0].label,
                ' ',
                initHints[0].fix ? (React.createElement("button", { type: "button", className: 'text-warning' }, initHints[0].fix.label)) : null))) : null,
        showExplain && (React.createElement(OperationExplainedBox, { stepNumber: 1, title: React.createElement(RawQuery, { query: `${query.metric} ${promQueryModeller.renderLabels(query.labels)}`, lang: lang }) }, EXPLAIN_LABEL_FILTER_CONTENT)),
        React.createElement(OperationsEditorRow, null,
            React.createElement(OperationList, { queryModeller: promQueryModeller, 
                // eslint-ignore
                datasource: datasource, query: query, onChange: onChange, onRunQuery: onRunQuery, highlightedOp: highlightedOp }),
            React.createElement(QueryBuilderHints, { datasource: datasource, query: query, onChange: onChange, data: data, queryModeller: promQueryModeller, buildVisualQueryFromString: buildVisualQueryFromString })),
        showExplain && (React.createElement(OperationListExplained, { lang: lang, query: query, stepNumber: 2, queryModeller: promQueryModeller, onMouseEnter: (op) => setHighlightedOp(op), onMouseLeave: () => setHighlightedOp(undefined) })),
        query.binaryQueries && query.binaryQueries.length > 0 && (React.createElement(NestedQueryList, { query: query, datasource: datasource, onChange: onChange, onRunQuery: onRunQuery, showExplain: showExplain }))));
});
PromQueryBuilder.displayName = 'PromQueryBuilder';
//# sourceMappingURL=PromQueryBuilder.js.map