import React, { useEffect, useState } from 'react';
import { useAsync } from 'react-use';

import { llms } from '@grafana/experimental';
import { Button, Icon, Spinner } from '@grafana/ui';
import { OperationExplainedBox } from 'app/plugins/datasource/prometheus/querybuilder/shared/OperationExplainedBox';

type Props = {
  logLine: string;
};

export const ExplainLogLine = ({ logLine }: Props) => {
  const [shouldRun, setShouldRun] = useState(false);
  const [llmReply, setLLMReply] = useState('');

  useAsync(async () => {
    if (shouldRun) {
      const info = await llms.openai.chatCompletions({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert in the field of log analysis. You are explaining the following log line sentences and explain how could they use it in log analysis in 2-3 sentences. If the log line has error, provide tips on how to resolve them:',
          },
          { role: 'user', content: logLine },
        ],
      });

      setLLMReply(info.choices[0].message.content);
    }
  }, [logLine, shouldRun]);

  useEffect(() => {
    // Reset when line changed
    setLLMReply('');
    setShouldRun(false);

    return () => {
      // reset on unmount
      setLLMReply('');
      setShouldRun(false);
    };
  }, [logLine]);

  return (
    <>
      <Button
        style={{ margin: '4px 0' }}
        size="sm"
        variant="secondary"
        onClick={() => setShouldRun(!shouldRun)}
        icon="ai"
      >
        Help me understand this log line
        <Icon name={`${shouldRun ? 'angle-up' : 'angle-down'}`} />
      </Button>
      {shouldRun && (
        <OperationExplainedBox title="Log line summary">
          {llmReply === '' ? <Spinner /> : <pre>{llmReply}</pre>}
        </OperationExplainedBox>
      )}
    </>
  );
};
