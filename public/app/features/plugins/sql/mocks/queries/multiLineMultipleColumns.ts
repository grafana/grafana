import { TestQueryModel } from '../../test-utils/types';

export const multiLineMultipleColumns: TestQueryModel = {
  query: `SELECT count(column1), column2 
  FROM table1 
  
  WHERE column1 = "value1" 
  GROUP BY column1 ORDER BY column1, avg(column2) DESC 
  LIMIT 10;`,
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
    ],
    [
      {
        offset: 0,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 4,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 5,
        type: 'identifier.sql',
        language: 'sql',
      },
      {
        offset: 11,
        type: 'white.sql',
        language: 'sql',
      },
    ],
    [
      {
        offset: 0,
        type: 'white.sql',
        language: 'sql',
      },
    ],
    [
      {
        offset: 0,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 5,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 6,
        type: 'identifier.sql',
        language: 'sql',
      },
      {
        offset: 13,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 14,
        type: 'operator.sql',
        language: 'sql',
      },
      {
        offset: 15,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 16,
        type: 'identifier.quote.sql',
        language: 'sql',
      },
      {
        offset: 17,
        type: 'identifier.sql',
        language: 'sql',
      },
      {
        offset: 23,
        type: 'identifier.quote.sql',
        language: 'sql',
      },
      {
        offset: 24,
        type: 'white.sql',
        language: 'sql',
      },
    ],
    [
      {
        offset: 0,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 5,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 6,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 8,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 9,
        type: 'identifier.sql',
        language: 'sql',
      },
      {
        offset: 16,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 17,
        type: 'keyword.sql',
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
        offset: 25,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 26,
        type: 'identifier.sql',
        language: 'sql',
      },
      {
        offset: 33,
        type: 'delimiter.sql',
        language: 'sql',
      },
      {
        offset: 34,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 35,
        type: 'predefined.sql',
        language: 'sql',
      },
      {
        offset: 38,
        type: 'delimiter.parenthesis.sql',
        language: 'sql',
      },
      {
        offset: 39,
        type: 'identifier.sql',
        language: 'sql',
      },
      {
        offset: 46,
        type: 'delimiter.parenthesis.sql',
        language: 'sql',
      },
      {
        offset: 47,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 48,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 52,
        type: 'white.sql',
        language: 'sql',
      },
    ],
    [
      {
        offset: 0,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 5,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 6,
        type: 'number.sql',
        language: 'sql',
      },
      {
        offset: 8,
        type: 'delimiter.sql',
        language: 'sql',
      },
    ],
  ],
};
