import { monacoTypes } from '@grafana/ui';

export const commentOnlyQuery = {
  query: `-- comment ending with whitespace     `,
  tokens: [
    [{ offset: 0, type: 'comment.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' }],
  ] as monacoTypes.Token[][],
};
