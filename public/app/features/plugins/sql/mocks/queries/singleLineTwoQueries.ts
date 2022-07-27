import { TestQueryModel } from '../../test-utils/types';

export const singleLineTwoQueries: TestQueryModel = {
  query:
    'SELECT column1, FROM table1 WHERE column1 = "value1" GROUP BY column1 ORDER BY column1 DESC LIMIT 10; SELECT column2, FROM table2 WHERE column2 = "value2" GROUP BY column1 ORDER BY column2 DESC LIMIT 10;',
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
      {
        offset: 16,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 20,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 21,
        type: 'identifier.sql',
        language: 'sql',
      },
      {
        offset: 27,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 28,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 33,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 34,
        type: 'identifier.sql',
        language: 'sql',
      },
      {
        offset: 41,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 42,
        type: 'operator.sql',
        language: 'sql',
      },
      {
        offset: 43,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 44,
        type: 'identifier.quote.sql',
        language: 'sql',
      },
      {
        offset: 45,
        type: 'identifier.sql',
        language: 'sql',
      },
      {
        offset: 51,
        type: 'identifier.quote.sql',
        language: 'sql',
      },
      {
        offset: 52,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 53,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 58,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 59,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 61,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 62,
        type: 'identifier.sql',
        language: 'sql',
      },
      {
        offset: 69,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 70,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 75,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 76,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 78,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 79,
        type: 'identifier.sql',
        language: 'sql',
      },
      {
        offset: 86,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 87,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 91,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 92,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 97,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 98,
        type: 'number.sql',
        language: 'sql',
      },
      {
        offset: 100,
        type: 'delimiter.sql',
        language: 'sql',
      },
      {
        offset: 101,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 102,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 108,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 109,
        type: 'identifier.sql',
        language: 'sql',
      },
      {
        offset: 116,
        type: 'delimiter.sql',
        language: 'sql',
      },
      {
        offset: 117,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 118,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 122,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 123,
        type: 'identifier.sql',
        language: 'sql',
      },
      {
        offset: 129,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 130,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 135,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 136,
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
        type: 'operator.sql',
        language: 'sql',
      },
      {
        offset: 145,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 146,
        type: 'identifier.quote.sql',
        language: 'sql',
      },
      {
        offset: 147,
        type: 'identifier.sql',
        language: 'sql',
      },
      {
        offset: 153,
        type: 'identifier.quote.sql',
        language: 'sql',
      },
      {
        offset: 154,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 155,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 160,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 161,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 163,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 164,
        type: 'identifier.sql',
        language: 'sql',
      },
      {
        offset: 171,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 172,
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
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 180,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 181,
        type: 'identifier.sql',
        language: 'sql',
      },
      {
        offset: 188,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 189,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 193,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 194,
        type: 'keyword.sql',
        language: 'sql',
      },
      {
        offset: 199,
        type: 'white.sql',
        language: 'sql',
      },
      {
        offset: 200,
        type: 'number.sql',
        language: 'sql',
      },
      {
        offset: 202,
        type: 'delimiter.sql',
        language: 'sql',
      },
    ],
  ],
};
