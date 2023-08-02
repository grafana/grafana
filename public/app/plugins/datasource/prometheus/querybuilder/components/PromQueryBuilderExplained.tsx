import React, { useState } from 'react';
import { useAsync } from 'react-use';

import { Stack, llms } from '@grafana/experimental';
import { Spinner } from '@grafana/ui';

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

  const [llmReply, setLLMReply] = useState('');

  const { value } = useAsync(async () => {
    // Check if the LLM plugin is enabled and configured.
    // If not, we won't be able to make requests, so return early.
    const enabled = await llms.openai.enabled();
    if (!enabled) {
      return { enabled };
    }

    llms.openai
      .streamChatCompletions({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert in the Prometheus query language PromQL. Explain the purpose of the following Prometheus query.',
          },
          { role: 'user', content: query },
        ],
      })
      .pipe(
        // Accumulate the stream content into a stream of strings, where each
        // element contains the accumulated message so far.
        llms.openai.accumulateContent()
      )
      .subscribe(setLLMReply);
    return { enabled };
  }, [query]);

  return (
    <Stack gap={0.5} direction="column">
      {value?.enabled && (
        <OperationExplainedBox title="Query summary">
          {llmReply === '' ? <Spinner /> : <pre>{llmReply}</pre>}
        </OperationExplainedBox>
      )}
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
