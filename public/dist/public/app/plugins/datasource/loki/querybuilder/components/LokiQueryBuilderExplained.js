import React from 'react';
import { Stack } from '@grafana/experimental';
import { OperationExplainedBox } from 'app/plugins/datasource/prometheus/querybuilder/shared/OperationExplainedBox';
import { OperationListExplained } from 'app/plugins/datasource/prometheus/querybuilder/shared/OperationListExplained';
import { RawQuery } from 'app/plugins/datasource/prometheus/querybuilder/shared/RawQuery';
import { lokiGrammar } from '../../syntax';
import { lokiQueryModeller } from '../LokiQueryModeller';
import { buildVisualQueryFromString } from '../parsing';
export const EXPLAIN_LABEL_FILTER_CONTENT = 'Fetch all log lines matching label filters.';
export const LokiQueryBuilderExplained = React.memo(({ query }) => {
    const visQuery = buildVisualQueryFromString(query || '').query;
    const lang = { grammar: lokiGrammar, name: 'lokiql' };
    return (React.createElement(Stack, { gap: 0, direction: "column" },
        React.createElement(OperationExplainedBox, { stepNumber: 1, title: React.createElement(RawQuery, { query: `${lokiQueryModeller.renderLabels(visQuery.labels)}`, lang: lang }) }, EXPLAIN_LABEL_FILTER_CONTENT),
        React.createElement(OperationListExplained, { stepNumber: 2, queryModeller: lokiQueryModeller, query: visQuery, lang: lang })));
});
LokiQueryBuilderExplained.displayName = 'LokiQueryBuilderExplained';
//# sourceMappingURL=LokiQueryBuilderExplained.js.map