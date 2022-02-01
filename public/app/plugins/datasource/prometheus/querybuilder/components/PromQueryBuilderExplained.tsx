import React from 'react';
import { PromVisualQuery } from '../types';
import { Stack } from '@grafana/experimental';
import { promQueryModeller } from '../PromQueryModeller';
import { OperationListExplained } from '../shared/OperationListExplained';
import { OperationExplainedBox } from '../shared/OperationExplainedBox';

export interface Props {
  query: PromVisualQuery;
  nested?: boolean;
}

export const PromQueryBuilderExplained = React.memo<Props>(({ query, nested }) => {
  return (
    <Stack gap={0} direction="column">
      <OperationExplainedBox stepNumber={1} title={`${query.metric} ${promQueryModeller.renderLabels(query.labels)}`}>
        Fetch all series matching metric name and label filters.
      </OperationExplainedBox>
      <OperationListExplained<PromVisualQuery> stepNumber={2} queryModeller={promQueryModeller} query={query} />
    </Stack>
  );
});

PromQueryBuilderExplained.displayName = 'PromQueryBuilderExplained';
