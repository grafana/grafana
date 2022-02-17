import React from 'react';
import { PromVisualQuery } from '../types';
import { Stack } from '@grafana/experimental';
import { promQueryModeller } from '../PromQueryModeller';
import { OperationListExplained } from '../shared/OperationListExplained';
import { OperationExplainedBox } from '../shared/OperationExplainedBox';
import { buildVisualQueryFromString } from '../parsing';

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
