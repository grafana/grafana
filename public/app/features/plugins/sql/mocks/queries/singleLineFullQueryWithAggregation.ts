import { TestQueryModel } from '../../test-utils/types';

export const singleLineFullQueryWithAggregation: TestQueryModel = {
  query: 'SELECT count(column1), FROM table1 WHERE column1 = "value1" GROUP BY column1 ORDER BY column1 DESC LIMIT 10;',
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
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 27,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 28,
        type: 'identifier.sql',
        language: 'sql',
      },
      {
        offset: 34,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 35,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 40,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 41,
        type: 'identifier.sql',
        language: 'sql',
      },
      {
        offset: 48,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 49,
        type: 'operator.sql',
        language: 'sql',
      },
      {
        offset: 50,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 51,
        type: 'identifier.quote.sql',
        language: 'sql',
      },
      {
        offset: 52,
        type: 'identifier.sql',
        language: 'sql',
      },
      {
        offset: 58,
        type: 'identifier.quote.sql',
        language: 'sql',
      },
      {
        offset: 59,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 60,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 65,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 66,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 68,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 69,
        type: 'identifier.sql',
        language: 'sql',
      },
      {
        offset: 76,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 77,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 82,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 83,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 85,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 86,
        type: 'identifier.sql',
        language: 'sql',
      },
      {
        offset: 93,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 94,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 98,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 99,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 104,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 105,
        type: 'number.sql',
        language: 'sql',
      },
      {
        offset: 107,
        type: 'delimiter.sql',
        language: 'sql',
      },
    ],
  ],
};
