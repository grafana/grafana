import React from 'react';
import { LokiVisualQuery } from '../types';
import { Stack } from '@grafana/experimental';
import { lokiQueryModeller } from '../LokiQueryModeller';
import { OperationListExplained } from 'app/plugins/datasource/prometheus/querybuilder/shared/OperationListExplained';
import { OperationExplainedBox } from 'app/plugins/datasource/prometheus/querybuilder/shared/OperationExplainedBox';

export interface Props {
  query: LokiVisualQuery;
  nested?: boolean;
}

export const LokiQueryBuilderExplained = React.memo<Props>(({ query, nested }) => {
  return (
    <Stack gap={0} direction="column">
      <OperationExplainedBox stepNumber={1} title={`${lokiQueryModeller.renderLabels(query.labels)}`}>
        Fetch all log lines matching label filters.
      </OperationExplainedBox>
      <OperationListExplained<LokiVisualQuery> stepNumber={2} queryModeller={lokiQueryModeller} query={query} />
    </Stack>
  );
});

LokiQueryBuilderExplained.displayName = 'LokiQueryBuilderExplained';
