import { monacoTypes } from '@grafana/ui';

export const multiLineFullQuery = {
  query: `SELECT 
  length(\`@message\`) as msg_length, 
  COUNT(*) as count, 
  MIN(\`@message\`) as sample_message 
FROM \`LogGroupA\` 
WHERE \`startTime\` >= date_sub(current_timestamp(), 1) 
GROUP BY length(\`@message\`) 
HAVING count > 10 
ORDER BY msg_length DESC 
/* 
a
comment
over
multiple
lines
*/
LIMIT 10`,
  tokens: [
    [
      { offset: 0, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 6, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
    ],
    [
      { offset: 0, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 2, type: 'predefined.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 8, type: 'delimiter.parenthesis.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 9, type: 'identifier.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 19, type: 'delimiter.parenthesis.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 20, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 21, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 23, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 24, type: 'identifier.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 34, type: 'delimiter.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 35, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
    ],
    [
      { offset: 0, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 2, type: 'predefined.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 7, type: 'delimiter.parenthesis.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 8, type: 'operator.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 9, type: 'delimiter.parenthesis.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 10, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 11, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 13, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 14, type: 'predefined.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 19, type: 'delimiter.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 20, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
    ],
    [
      { offset: 0, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 2, type: 'predefined.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 5, type: 'delimiter.parenthesis.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 6, type: 'identifier.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 16, type: 'delimiter.parenthesis.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 17, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 18, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 20, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 21, type: 'identifier.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 35, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
    ],
    [
      { offset: 0, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 4, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 5, type: 'identifier.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 16, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
    ],
    [
      { offset: 0, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 5, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 6, type: 'identifier.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 17, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 18, type: 'operator.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 20, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 21, type: 'predefined.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 29, type: 'delimiter.parenthesis.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 30, type: 'predefined.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 47, type: 'delimiter.parenthesis.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 49, type: 'delimiter.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 50, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 51, type: 'number.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 52, type: 'delimiter.parenthesis.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 53, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
    ],
    [
      { offset: 0, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 5, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 6, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 8, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 9, type: 'predefined.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 15, type: 'delimiter.parenthesis.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 16, type: 'identifier.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 26, type: 'delimiter.parenthesis.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 27, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
    ],
    [
      { offset: 0, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 6, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 7, type: 'predefined.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 12, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 13, type: 'operator.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 14, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 15, type: 'number.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 17, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
    ],
    [
      { offset: 0, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 5, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 6, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 8, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 9, type: 'identifier.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 19, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 20, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 24, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
    ],
    [
      { offset: 0, type: 'comment.quote.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 2, type: 'comment.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
    ],
    [{ offset: 0, type: 'comment.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' }],
    [{ offset: 0, type: 'comment.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' }],
    [{ offset: 0, type: 'comment.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' }],
    [{ offset: 0, type: 'comment.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' }],
    [{ offset: 0, type: 'comment.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' }],
    [{ offset: 0, type: 'comment.quote.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' }],
    [
      { offset: 0, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 5, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 6, type: 'number.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
    ],
  ] as monacoTypes.Token[][],
};
