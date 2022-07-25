import React from 'react';

import { Stack } from '@grafana/ui';
import { OperationExplainedBox } from 'app/plugins/datasource/prometheus/querybuilder/shared/OperationExplainedBox';
import { OperationListExplained } from 'app/plugins/datasource/prometheus/querybuilder/shared/OperationListExplained';
import { RawQuery } from 'app/plugins/datasource/prometheus/querybuilder/shared/RawQuery';

import { lokiGrammar } from '../../syntax';
import { lokiQueryModeller } from '../LokiQueryModeller';
import { buildVisualQueryFromString } from '../parsing';
import { LokiVisualQuery } from '../types';

export interface Props {
  query: string;
}

export const LokiQueryBuilderExplained = React.memo<Props>(({ query }) => {
  const visQuery = buildVisualQueryFromString(query || '').query;
  const lang = { grammar: lokiGrammar, name: 'lokiql' };

  return (
    <Stack gap={0} direction="column">
      <OperationExplainedBox>
        <RawQuery query={query} lang={lang} />
      </OperationExplainedBox>
      <OperationExplainedBox
        stepNumber={1}
        title={<RawQuery query={`${lokiQueryModeller.renderLabels(visQuery.labels)}`} lang={lang} />}
      >
        Fetch all log lines matching label filters.
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
