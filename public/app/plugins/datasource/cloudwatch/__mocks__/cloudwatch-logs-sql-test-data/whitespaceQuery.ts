import { monacoTypes } from '@grafana/ui';

export const whitespaceQuery = {
  query: ' ',
  tokens: [
    [{ offset: 0, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' }],
  ] as monacoTypes.Token[][],
};
