import { monacoTypes } from '@grafana/ui';

export const sqlTestDataMultiLineIncompleteQueryWithoutNamespace = {
  query: `SELECT AVG(CPUUtilization) 
  FROM `,
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
    ],
  ] as monacoTypes.Token[][],
};
