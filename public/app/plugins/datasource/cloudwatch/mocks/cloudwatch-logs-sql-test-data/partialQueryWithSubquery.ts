import { monacoTypes } from '@grafana/ui';

export const partialQueryWithSubquery = {
  query: 'SELECT requestId FROM LogGroupA WHERE requestId IN ()',
  tokens: [
    [
      { offset: 0, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 6, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 7, type: 'identifier.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 16, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 17, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 21, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 22, type: 'identifier.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 31, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 32, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 37, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 38, type: 'identifier.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 47, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 48, type: 'operator.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 50, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 51, type: 'delimiter.parenthesis.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
    ],
  ] as monacoTypes.Token[][],
};
