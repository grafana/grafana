import React from 'react';

import { Stack } from '@grafana/experimental';

import promqlGrammar from '../../promql';
import { promQueryModeller } from '../PromQueryModeller';
import { buildVisualQueryFromString } from '../parsing';
import { OperationExplainedBox } from '../shared/OperationExplainedBox';
import { OperationListExplained } from '../shared/OperationListExplained';
import { RawQuery } from '../shared/RawQuery';
import { PromVisualQuery } from '../types';

export const EXPLAIN_LABEL_FILTER_CONTENT = 'Fetch all series matching metric name and label filters.';

export interface Props {
  query: string;
}

export const PromQueryBuilderExplained = React.memo<Props>(({ query }) => {
  const visQuery = buildVisualQueryFromString(query || '').query;
  const lang = { grammar: promqlGrammar, name: 'promql' };

  return (
    <Stack gap={0.5} direction="column">
      <OperationExplainedBox
        stepNumber={1}
        title={<RawQuery query={`${visQuery.metric} ${promQueryModeller.renderLabels(visQuery.labels)}`} lang={lang} />}
      >
        {EXPLAIN_LABEL_FILTER_CONTENT}
      </OperationExplainedBox>
      <OperationListExplained<PromVisualQuery>
        stepNumber={2}
        queryModeller={promQueryModeller}
        query={visQuery}
        lang={lang}
      />
    </Stack>
  );
});

PromQueryBuilderExplained.displayName = 'PromQueryBuilderExplained';
