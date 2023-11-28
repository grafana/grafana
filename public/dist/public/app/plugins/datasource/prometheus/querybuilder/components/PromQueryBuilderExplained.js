import React from 'react';
import { Stack } from '@grafana/experimental';
import promqlGrammar from '../../promql';
import { promQueryModeller } from '../PromQueryModeller';
import { buildVisualQueryFromString } from '../parsing';
import { OperationExplainedBox } from '../shared/OperationExplainedBox';
import { OperationListExplained } from '../shared/OperationListExplained';
import { RawQuery } from '../shared/RawQuery';
export const EXPLAIN_LABEL_FILTER_CONTENT = 'Fetch all series matching metric name and label filters.';
export const PromQueryBuilderExplained = React.memo(({ query }) => {
    const visQuery = buildVisualQueryFromString(query || '').query;
    const lang = { grammar: promqlGrammar, name: 'promql' };
    return (React.createElement(Stack, { gap: 0.5, direction: "column" },
        React.createElement(OperationExplainedBox, { stepNumber: 1, title: React.createElement(RawQuery, { query: `${visQuery.metric} ${promQueryModeller.renderLabels(visQuery.labels)}`, lang: lang }) }, EXPLAIN_LABEL_FILTER_CONTENT),
        React.createElement(OperationListExplained, { stepNumber: 2, queryModeller: promQueryModeller, query: visQuery, lang: lang })));
});
PromQueryBuilderExplained.displayName = 'PromQueryBuilderExplained';
//# sourceMappingURL=PromQueryBuilderExplained.js.map