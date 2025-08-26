import { memo } from 'react';

import { OperationExplainedBox, OperationListExplained, RawQuery } from '@grafana/plugin-ui';
import { Stack } from '@grafana/ui';

import { lokiGrammar } from '../../syntax';
import { lokiQueryModeller } from '../LokiQueryModeller';
import { buildVisualQueryFromString } from '../parsing';
import { LokiVisualQuery } from '../types';

export const EXPLAIN_LABEL_FILTER_CONTENT = 'Fetch all log lines matching label filters.';

export interface Props {
  query: string;
}

export const LokiQueryBuilderExplained = memo<Props>(({ query }) => {
  const visQuery = buildVisualQueryFromString(query || '').query;
  const lang = { grammar: lokiGrammar, name: 'lokiql' };

  return (
    <Stack gap={0} direction="column">
      <OperationExplainedBox
        stepNumber={1}
        title={<RawQuery query={`${lokiQueryModeller.renderLabels(visQuery.labels)}`} language={lang} />}
      >
        {EXPLAIN_LABEL_FILTER_CONTENT}
      </OperationExplainedBox>
      <OperationListExplained<LokiVisualQuery>
        stepNumber={2}
        queryModeller={lokiQueryModeller}
        query={visQuery}
        language={lang}
      />
    </Stack>
  );
});

LokiQueryBuilderExplained.displayName = 'LokiQueryBuilderExplained';
