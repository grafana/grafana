import { monacoTypes } from '@grafana/ui';

export const multiLineFullQueryWithCaseClause = {
  query: `SELECT id, 
CASE id 
WHEN 100 THEN 'big' 
WHEN id > 300 THEN 'biggest' 
ELSE 'small' 
END as size 
FROM LogGroupA 
WHERE 
CASE 1 = 1 
WHEN 100 THEN 'long' 
WHEN 200 THEN 'longest' 
ELSE 'short' 
END = 'short'  
ORDER BY message_count DESC`,
  tokens: [
    [
      { offset: 0, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 6, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 7, type: 'identifier.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 9, type: 'delimiter.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 10, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
    ],
    [
      { offset: 0, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 4, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 5, type: 'identifier.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 7, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
    ],
    [
      { offset: 0, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 4, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 5, type: 'number.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 8, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 9, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 13, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 14, type: 'string.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 15, type: 'string.escape.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 18, type: 'string.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 19, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
    ],
    [
      { offset: 0, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 4, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 5, type: 'identifier.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 7, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 8, type: 'operator.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 9, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 10, type: 'number.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 13, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 14, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 18, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 19, type: 'string.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 20, type: 'string.escape.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 27, type: 'string.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 28, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
    ],
    [
      { offset: 0, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 4, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 5, type: 'string.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 6, type: 'string.escape.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 11, type: 'string.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 12, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
    ],
    [
      { offset: 0, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 3, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 4, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 6, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 7, type: 'identifier.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 11, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
    ],
    [
      { offset: 0, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 4, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 5, type: 'identifier.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 14, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
    ],
    [
      { offset: 0, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 5, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
    ],
    [
      { offset: 0, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 4, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 5, type: 'number.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 6, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 7, type: 'operator.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 8, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 9, type: 'number.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 10, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
    ],
    [
      { offset: 0, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 4, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 5, type: 'number.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 8, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 9, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 13, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 14, type: 'string.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 15, type: 'string.escape.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 19, type: 'string.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 20, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
    ],
    [
      { offset: 0, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 4, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 5, type: 'number.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 8, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 9, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 13, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 14, type: 'string.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 15, type: 'string.escape.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 22, type: 'string.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 23, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
    ],
    [
      { offset: 0, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 4, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 5, type: 'string.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 6, type: 'string.escape.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 11, type: 'string.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 12, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
    ],
    [
      { offset: 0, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 3, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 4, type: 'operator.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 5, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 6, type: 'string.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 7, type: 'string.escape.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 12, type: 'string.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 13, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
    ],
    [
      { offset: 0, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 5, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 6, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 8, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 9, type: 'identifier.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 22, type: 'white.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
      { offset: 23, type: 'keyword.cloudwatch-logs-sql', language: 'cloudwatch-logs-sql' },
    ],
  ] as monacoTypes.Token[][],
};
