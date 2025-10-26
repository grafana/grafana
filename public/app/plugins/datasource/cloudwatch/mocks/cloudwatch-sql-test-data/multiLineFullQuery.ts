import { monacoTypes } from '@grafana/ui';

export const sqlTestDataMultiLineFullQuery = {
  query: `SELECT AVG(CPUUtilization) 
  FROM SCHEMA("AWS/ECS", InstanceId) 
  
  WHERE InstanceId = 'i-03c6908092db17ac9' 
  GROUP BY InstanceId ORDER BY AVG() DESC 
  LIMIT 10`,
  tokens: [
    [
      {
        offset: 0,
        type: 'keyword.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 6,
        type: 'white.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 7,
        type: 'predefined.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 10,
        type: 'delimiter.parenthesis.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 11,
        type: 'identifier.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 25,
        type: 'delimiter.parenthesis.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 26,
        type: 'white.sql',
        language: 'cloudwatch-sql',
      },
    ],
    [
      {
        offset: 0,
        type: 'keyword.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 4,
        type: 'white.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 5,
        type: 'keyword.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 11,
        type: 'delimiter.parenthesis.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 12,
        type: 'type.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 21,
        type: 'delimiter.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 22,
        type: 'white.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 23,
        type: 'identifier.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 33,
        type: 'delimiter.parenthesis.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 34,
        type: 'white.sql',
        language: 'cloudwatch-sql',
      },
    ],
    [],
    [
      {
        offset: 0,
        type: 'keyword.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 5,
        type: 'white.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 6,
        type: 'identifier.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 16,
        type: 'white.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 17,
        type: 'operator.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 18,
        type: 'white.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 19,
        type: 'string.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 40,
        type: 'white.sql',
        language: 'cloudwatch-sql',
      },
    ],
    [
      {
        offset: 0,
        type: 'keyword.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 5,
        type: 'white.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 6,
        type: 'keyword.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 8,
        type: 'white.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 9,
        type: 'identifier.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 19,
        type: 'white.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 20,
        type: 'keyword.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 25,
        type: 'white.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 26,
        type: 'keyword.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 28,
        type: 'white.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 29,
        type: 'predefined.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 32,
        type: 'delimiter.parenthesis.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 34,
        type: 'white.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 35,
        type: 'keyword.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 39,
        type: 'white.sql',
        language: 'cloudwatch-sql',
      },
    ],
    [
      {
        offset: 0,
        type: 'keyword.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 5,
        type: 'white.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 6,
        type: 'number.sql',
        language: 'cloudwatch-sql',
      },
    ],
  ] as monacoTypes.Token[][],
};
