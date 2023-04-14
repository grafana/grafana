import React from 'react';

import { Stack } from '@grafana/experimental';
import { OperationExplainedBox } from 'app/plugins/datasource/prometheus/querybuilder/shared/OperationExplainedBox';
import { OperationListExplained } from 'app/plugins/datasource/prometheus/querybuilder/shared/OperationListExplained';
import { RawQuery } from 'app/plugins/datasource/prometheus/querybuilder/shared/RawQuery';

import { lokiGrammar } from '../../syntax';
import { lokiQueryModeller } from '../LokiQueryModeller';
import { buildVisualQueryFromString } from '../parsing';
import { LokiVisualQuery } from '../types';

export const EXPLAIN_LABEL_FILTER_CONTENT = 'Fetch all log lines matching label filters.';

export interface Props {
  query: string;
}

export const LokiQueryBuilderExplained = React.memo<Props>(({ query }) => {
  const visQuery = buildVisualQueryFromString(query || '').query;
  const lang = { grammar: lokiGrammar, name: 'lokiql' };

  return (
    <Stack gap={0} direction="column">
      <OperationExplainedBox
        stepNumber={1}
        title={<RawQuery query={`${lokiQueryModeller.renderLabels(visQuery.labels)}`} lang={lang} />}
      >
        {EXPLAIN_LABEL_FILTER_CONTENT}
      </OperationExplainedBox>
      <OperationListExplained<LokiVisualQuery>
        stepNumber={2}
        queryModeller={lokiQueryModeller}
        query={visQuery}
        lang={lang}
      />
    </Stack>
  );
});

LokiQueryBuilderExplained.displayName = 'LokiQueryBuilderExplained';
