import { monacoTypes } from '@grafana/ui';

export const partialQueryWithFunction = {
  query: `SELECT length()`,
  tokens: [
    [
      { offset: 0, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 6, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 7, type: 'predefined.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 13, type: 'delimiter.parenthesis.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
    ],
  ] as monacoTypes.Token[][],
};
