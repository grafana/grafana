import { monacoTypes } from '@grafana/ui';

export const sqlTestDataSingleLineFullQuery = {
  query: `SELECT AVG(CPUUtilization) FROM SCHEMA("AWS/EC2", InstanceId) WHERE InstanceId = 'i-03c6908092db17ac9' GROUP BY InstanceId ORDER BY AVG() DESC LIMIT 10`,
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
      {
        offset: 27,
        type: 'keyword.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 31,
        type: 'white.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 32,
        type: 'keyword.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 38,
        type: 'delimiter.parenthesis.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 39,
        type: 'type.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 48,
        type: 'delimiter.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 49,
        type: 'white.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 50,
        type: 'identifier.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 60,
        type: 'delimiter.parenthesis.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 61,
        type: 'white.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 62,
        type: 'keyword.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 67,
        type: 'white.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 68,
        type: 'identifier.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 78,
        type: 'white.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 79,
        type: 'operator.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 80,
        type: 'white.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 81,
        type: 'string.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 102,
        type: 'white.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 103,
        type: 'keyword.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 108,
        type: 'white.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 109,
        type: 'keyword.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 111,
        type: 'white.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 112,
        type: 'identifier.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 122,
        type: 'white.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 123,
        type: 'keyword.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 128,
        type: 'white.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 129,
        type: 'keyword.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 131,
        type: 'white.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 132,
        type: 'predefined.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 135,
        type: 'delimiter.parenthesis.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 137,
        type: 'white.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 138,
        type: 'keyword.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 142,
        type: 'white.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 143,
        type: 'keyword.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 148,
        type: 'white.sql',
        language: 'cloudwatch-sql',
      },
      {
        offset: 149,
        type: 'number.sql',
        language: 'cloudwatch-sql',
      },
    ],
  ] as monacoTypes.Token[][],
};
