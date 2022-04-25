import React from 'react';

import { Stack } from '@grafana/experimental';

import { promQueryModeller } from '../PromQueryModeller';
import { buildVisualQueryFromString } from '../parsing';
import { OperationExplainedBox } from '../shared/OperationExplainedBox';
import { OperationListExplained } from '../shared/OperationListExplained';
import { PromVisualQuery } from '../types';

export interface Props {
  query: string;
  nested?: boolean;
}

export const PromQueryBuilderExplained = React.memo<Props>(({ query, nested }) => {
  const visQuery = buildVisualQueryFromString(query || '').query;

  return (
    <Stack gap={0} direction="column">
      <OperationExplainedBox
        stepNumber={1}
        title={`${visQuery.metric} ${promQueryModeller.renderLabels(visQuery.labels)}`}
      >
        Fetch all series matching metric name and label filters.
      </OperationExplainedBox>
      <OperationListExplained<PromVisualQuery> stepNumber={2} queryModeller={promQueryModeller} query={visQuery} />
    </Stack>
  );
});

PromQueryBuilderExplained.displayName = 'PromQueryBuilderExplained';
