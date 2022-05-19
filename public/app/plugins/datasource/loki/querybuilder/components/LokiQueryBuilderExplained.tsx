import React from 'react';

import { Stack } from '@grafana/experimental';
import { OperationExplainedBox } from 'app/plugins/datasource/prometheus/querybuilder/shared/OperationExplainedBox';
import { OperationListExplained } from 'app/plugins/datasource/prometheus/querybuilder/shared/OperationListExplained';

import { lokiQueryModeller } from '../LokiQueryModeller';
import { buildVisualQueryFromString } from '../parsing';
import { LokiVisualQuery } from '../types';

export interface Props {
  query: string;
  nested?: boolean;
}

export const LokiQueryBuilderExplained = React.memo<Props>(({ query, nested }) => {
  const visQuery = buildVisualQueryFromString(query || '').query;

  return (
    <Stack gap={0} direction="column">
      <OperationExplainedBox stepNumber={1} title={`${lokiQueryModeller.renderLabels(visQuery.labels)}`}>
        Fetch all log lines matching label filters.
      </OperationExplainedBox>
      <OperationListExplained<LokiVisualQuery> stepNumber={2} queryModeller={lokiQueryModeller} query={visQuery} />
    </Stack>
  );
});

LokiQueryBuilderExplained.displayName = 'LokiQueryBuilderExplained';
