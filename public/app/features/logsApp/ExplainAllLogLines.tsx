import React, { useEffect, useState } from 'react';
import { useAsync } from 'react-use';

import { llms } from '@grafana/experimental';
import { Button, Icon, Spinner } from '@grafana/ui';
import { OperationExplainedBox } from 'app/plugins/datasource/prometheus/querybuilder/shared/OperationExplainedBox';

type Props = {
  logLines: string[];
};

export const ExplainAllLogLines = ({ logLines }: Props) => {
  const [shouldRun, setShouldRun] = useState(false);
  const [llmReply, setLLMReply] = useState('');

  // prevents sending too much data to the API
  const logLinesString = logLines.join('\n').slice(0, 5000);

  useAsync(async () => {
    if (shouldRun) {
      const info = await llms.openai.chatCompletions({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              "As an expert in log analysis, I'm seeking your insights on a set of log lines that I've encountered. Please provide a comprehensive overview of these log entries, condensing your analysis into up to 10 sentences. Additionally, if any errors or anomalies are identified within the logs, kindly summarize those for further clarity:",
          },
          { role: 'user', content: logLinesString },
        ],
      });

      setLLMReply(info.choices[0].message.content);
    }
  }, [logLinesString, shouldRun]);

  useEffect(() => {
    // Reset when line changed
    setLLMReply('');
    setShouldRun(false);

    return () => {
      // reset on unmount
      setLLMReply('');
      setShouldRun(false);
    };
  }, [logLinesString]);

  return (
    <>
      <Button
        style={{ margin: '4px 0' }}
        size="sm"
        variant="secondary"
        onClick={() => setShouldRun(!shouldRun)}
        icon="ai"
      >
        Help me understand my log lines
        <Icon name={`${shouldRun ? 'angle-up' : 'angle-down'}`} />
      </Button>
      {shouldRun && (
        <OperationExplainedBox>{llmReply === '' ? <Spinner /> : <pre>{llmReply}</pre>}</OperationExplainedBox>
      )}
    </>
  );
};
