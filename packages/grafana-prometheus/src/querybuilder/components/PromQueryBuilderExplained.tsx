// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/PromQueryBuilderExplained.tsx
import { memo } from 'react';

import { Stack } from '@grafana/ui';

import promqlGrammar from '../../promql';
import { promQueryModeller } from '../PromQueryModeller';
import { buildVisualQueryFromString } from '../parsing';
import { OperationExplainedBox } from '../shared/OperationExplainedBox';
import { OperationListExplained } from '../shared/OperationListExplained';
import { RawQuery } from '../shared/RawQuery';
import { PromVisualQuery } from '../types';

export const EXPLAIN_LABEL_FILTER_CONTENT = 'Fetch all series matching metric name and label filters.';

export interface PromQueryBuilderExplainedProps {
  query: string;
}

export const PromQueryBuilderExplained = memo<PromQueryBuilderExplainedProps>(({ query }) => {
  const visQuery = buildVisualQueryFromString(query || '').query;
  const lang = { grammar: promqlGrammar, name: 'promql' };

  return (
    <Stack gap={0.5} direction="column">
      <OperationExplainedBox
        stepNumber={1}
        title={<RawQuery query={`${promQueryModeller.renderQuery(visQuery)}`} lang={lang} />}
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
