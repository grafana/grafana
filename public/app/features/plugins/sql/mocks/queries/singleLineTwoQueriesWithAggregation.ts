import { TestQueryModel } from '../../test-utils/types';

export const singleLineTwoQueriesWithAggregation: TestQueryModel = {
  query:
    'SELECT count(column1), FROM table1 WHERE column1 = "value1" GROUP BY column1 ORDER BY column1 DESC LIMIT 10; SELECT count(column2), FROM table2 WHERE column2 = "value2" GROUP BY column1 ORDER BY column2 DESC LIMIT 10;',
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
      {
        offset: 108,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 109,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 115,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 116,
        type: 'predefined.sql',
        language: 'sql',
      },
      {
        offset: 121,
        type: 'delimiter.parenthesis.sql',
        language: 'sql',
      },
      {
        offset: 122,
        type: 'identifier.sql',
        language: 'sql',
      },
      {
        offset: 129,
        type: 'delimiter.parenthesis.sql',
        language: 'sql',
      },
      {
        offset: 130,
        type: 'delimiter.sql',
        language: 'sql',
      },
      {
        offset: 131,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 132,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 136,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 137,
        type: 'identifier.sql',
        language: 'sql',
      },
      {
        offset: 143,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 144,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 149,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 150,
        type: 'identifier.sql',
        language: 'sql',
      },
      {
        offset: 157,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 158,
        type: 'operator.sql',
        language: 'sql',
      },
      {
        offset: 159,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 160,
        type: 'identifier.quote.sql',
        language: 'sql',
      },
      {
        offset: 161,
        type: 'identifier.sql',
        language: 'sql',
      },
      {
        offset: 167,
        type: 'identifier.quote.sql',
        language: 'sql',
      },
      {
        offset: 168,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 169,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 174,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 175,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 177,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 178,
        type: 'identifier.sql',
        language: 'sql',
      },
      {
        offset: 185,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 186,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 191,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 192,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 194,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 195,
        type: 'identifier.sql',
        language: 'sql',
      },
      {
        offset: 202,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 203,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 207,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 208,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 213,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 214,
        type: 'number.sql',
        language: 'sql',
      },
      {
        offset: 216,
        type: 'delimiter.sql',
        language: 'sql',
      },
    ],
  ],
};
