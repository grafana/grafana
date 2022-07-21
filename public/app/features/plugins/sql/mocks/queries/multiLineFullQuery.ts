import { TestQueryModel } from '../../test-utils/types';

export const multiLineFullQuery: TestQueryModel = {
  query: `SELECT column1,  
  FROM table1 
  
  WHERE column1 = "value1" 
  GROUP BY column1 ORDER BY column1 DESC 
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
        type: 'identifier.sql',
        language: 'sql',
      },
      {
        offset: 14,
        type: 'delimiter.sql',
        language: 'sql',
      },
      {
        offset: 15,
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
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 34,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 38,
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
