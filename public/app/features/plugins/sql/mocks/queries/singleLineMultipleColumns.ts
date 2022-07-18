import { TestQueryModel } from '../../test-utils/types';

export const singleLineMultipleColumns: TestQueryModel = {
  query:
    'SELECT count(column1), column2 FROM table1 WHERE column1 = "value1" GROUP BY column1 ORDER BY column1, avg(column2) DESC LIMIT 10;',
  tokens: [
    [
      {
        offset: 0,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 6,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 7,
        type: 'predefined.sql',
        language: 'sql',
      },
      {
        offset: 12,
        type: 'delimiter.parenthesis.sql',
        language: 'sql',
      },
      {
        offset: 13,
        type: 'identifier.sql',
        language: 'sql',
      },
      {
        offset: 20,
        type: 'delimiter.parenthesis.sql',
        language: 'sql',
      },
      {
        offset: 21,
        type: 'delimiter.sql',
        language: 'sql',
      },
      {
        offset: 22,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 23,
        type: 'identifier.sql',
        language: 'sql',
      },
      {
        offset: 30,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 31,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 35,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 36,
        type: 'identifier.sql',
        language: 'sql',
      },
      {
        offset: 42,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 43,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 48,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 49,
        type: 'identifier.sql',
        language: 'sql',
      },
      {
        offset: 56,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 57,
        type: 'operator.sql',
        language: 'sql',
      },
      {
        offset: 58,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 59,
        type: 'identifier.quote.sql',
        language: 'sql',
      },
      {
        offset: 60,
        type: 'identifier.sql',
        language: 'sql',
      },
      {
        offset: 66,
        type: 'identifier.quote.sql',
        language: 'sql',
      },
      {
        offset: 67,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 68,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 73,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 74,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 76,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 77,
        type: 'identifier.sql',
        language: 'sql',
      },
      {
        offset: 84,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 85,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 90,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 91,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 93,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 94,
        type: 'identifier.sql',
        language: 'sql',
      },
      {
        offset: 101,
        type: 'delimiter.sql',
        language: 'sql',
      },
      {
        offset: 102,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 103,
        type: 'predefined.sql',
        language: 'sql',
      },
      {
        offset: 106,
        type: 'delimiter.parenthesis.sql',
        language: 'sql',
      },
      {
        offset: 107,
        type: 'identifier.sql',
        language: 'sql',
      },
      {
        offset: 114,
        type: 'delimiter.parenthesis.sql',
        language: 'sql',
      },
      {
        offset: 115,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 116,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 120,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 121,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 126,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 127,
        type: 'number.sql',
        language: 'sql',
      },
      {
        offset: 129,
        type: 'delimiter.sql',
        language: 'sql',
      },
    ],
  ],
};
