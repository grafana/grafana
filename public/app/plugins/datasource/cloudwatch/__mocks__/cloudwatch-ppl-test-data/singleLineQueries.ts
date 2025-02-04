import { monacoTypes } from '@grafana/ui';

import { CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID } from '../../language/cloudwatch-ppl/language';
import { PPLTokenTypes } from '../../language/cloudwatch-ppl/tokenTypes';

export const emptyQuery = {
  query: '',
  tokens: [],
};

export const whitespaceOnlyQuery = {
  query: '   ',
  tokens: [
    [{ offset: 0, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }],
  ] as monacoTypes.Token[][],
};

export const whereQuery = {
  query: 'WHERE like(`@message`, "%Exception%") AND not like(server, "test") in ()',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "WHERE"
      { offset: 5, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 6, type: PPLTokenTypes.Function, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "like"
      { offset: 10, type: PPLTokenTypes.Parenthesis, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
      { offset: 11, type: PPLTokenTypes.Backtick, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "`@message`"
      { offset: 21, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 22, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 23, type: PPLTokenTypes.String, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "%Exception"
      { offset: 36, type: PPLTokenTypes.Parenthesis, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ")"
      { offset: 37, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 38, type: PPLTokenTypes.Operator, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "and"
      { offset: 41, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 42, type: PPLTokenTypes.Operator, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "not"
      { offset: 45, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 46, type: PPLTokenTypes.Function, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "like"
      { offset: 50, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
      { offset: 51, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "server"
      { offset: 57, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 58, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 59, type: PPLTokenTypes.String, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "'test'"
      { offset: 55, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ")"
      { offset: 66, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 67, type: PPLTokenTypes.Keyword, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "in"
      { offset: 69, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 70, type: PPLTokenTypes.Parenthesis, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
    ],
  ] as monacoTypes.Token[][],
};
export const fieldsQuery = {
  query: 'FIELDS + `@ingestionTime`, timestamp, table',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "fields"
      { offset: 6, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 7, type: PPLTokenTypes.Operator, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "+"
      { offset: 8, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 9, type: PPLTokenTypes.Backtick, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "@ingestionTime"
      { offset: 25, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 26, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " ",
      { offset: 27, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "timestamp",
      { offset: 36, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 37, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 38, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "table"
    ],
  ] as monacoTypes.Token[][],
};

export const statsQuery = {
  query: 'stats avg(timestamp) as exceptionCount by span(`@timestamp`, 1h)',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "stats"
      { offset: 5, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 6, type: PPLTokenTypes.Function, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "avg"
      { offset: 9, type: PPLTokenTypes.Parenthesis, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
      { offset: 10, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "timestamp",
      { offset: 19, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ")",
      { offset: 20, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 21, type: PPLTokenTypes.Keyword, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "as"
      { offset: 23, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 24, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "exceptionCount"
      { offset: 38, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 39, type: PPLTokenTypes.Keyword, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "by"
      { offset: 41, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 42, type: PPLTokenTypes.Function, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "span"
      { offset: 46, type: PPLTokenTypes.Parenthesis, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
      { offset: 47, type: PPLTokenTypes.Backtick, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "@timestmap"
      { offset: 59, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 60, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 61, type: PPLTokenTypes.Number, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "1h"
    ],
  ] as monacoTypes.Token[][],
};

export const eventStatsQuery = {
  query: 'EVENTSTATS avg(timestamp) as exceptionCount by span(`@timestamp`, 1h)',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "eventstats"
      { offset: 10, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 11, type: PPLTokenTypes.Function, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "avg"
      { offset: 14, type: PPLTokenTypes.Parenthesis, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
      { offset: 15, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "timestamp",
      { offset: 24, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ")",
      { offset: 25, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 26, type: PPLTokenTypes.Keyword, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "as"
      { offset: 28, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 29, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "exceptionCount"
      { offset: 43, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 44, type: PPLTokenTypes.Keyword, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "by"
      { offset: 46, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 47, type: PPLTokenTypes.Function, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "span"
      { offset: 51, type: PPLTokenTypes.Parenthesis, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
      { offset: 52, type: PPLTokenTypes.Backtick, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "@timestmap"
      { offset: 64, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 65, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 66, type: PPLTokenTypes.Number, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "1h"
    ],
  ] as monacoTypes.Token[][],
};

export const sortQuery = {
  query: 'sort - DisconnectReason, + timestamp, server',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "sort"
      { offset: 4, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 5, type: PPLTokenTypes.Operator, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "-"
      { offset: 6, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 7, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "DisconnectReason"
      { offset: 23, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 24, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 25, type: PPLTokenTypes.Operator, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "+"
      { offset: 26, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 27, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "timestamp"
      { offset: 36, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 37, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 38, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "server"
    ],
  ] as monacoTypes.Token[][],
};
export const sortQueryWithFunctions = {
  query: 'sort - AUTO(DisconnectReason)',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "sort"
      { offset: 4, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 5, type: PPLTokenTypes.Operator, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "-"
      { offset: 6, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 7, type: PPLTokenTypes.Function, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "AUTO"
      { offset: 11, type: PPLTokenTypes.Parenthesis, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
      { offset: 12, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "DisconnectReason"
    ],
  ] as monacoTypes.Token[][],
};

export const dedupQueryWithOptionalArgs = {
  query: 'DEDUP 5 timestamp, ingestionTime, `@query` keepempty = true consecutive = false',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "dedup"
      { offset: 5, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 6, type: PPLTokenTypes.Number, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "5"
      { offset: 7, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 8, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "timestamp"
      { offset: 17, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 18, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 19, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "ingestionTime"
      { offset: 32, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 33, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 34, type: PPLTokenTypes.Backtick, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "`@query`"
      { offset: 42, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 43, type: PPLTokenTypes.Keyword, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "keepempty"
      { offset: 52, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 53, type: PPLTokenTypes.Operator, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 54, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 55, type: PPLTokenTypes.Keyword, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "true"
      { offset: 59, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 60, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "consecutive"
      { offset: 71, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 72, type: PPLTokenTypes.Operator, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 73, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 74, type: PPLTokenTypes.Keyword, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "false"
    ],
  ] as monacoTypes.Token[][],
};

export const dedupQueryWithoutOptionalArgs = {
  query: 'DEDUP timestamp, ingestionTime, `@query`',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "dedup"
      { offset: 5, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 6, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "timestamp"
      { offset: 15, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 16, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 17, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "ingestionTime"
      { offset: 30, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 31, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 32, type: PPLTokenTypes.Backtick, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "`@query`"
    ],
  ] as monacoTypes.Token[][],
};

export const topQuery = {
  query: 'TOP 100 ingestionTime, timestamp by server, region',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "top"
      { offset: 3, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 4, type: PPLTokenTypes.Number, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "100"
      { offset: 7, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 8, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "ingestionTime"
      { offset: 21, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 22, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 23, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "timestamp"
      { offset: 32, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 33, type: PPLTokenTypes.Keyword, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "by"
      { offset: 35, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 36, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "server"
      { offset: 42, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 43, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 44, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "region"
    ],
  ] as monacoTypes.Token[][],
};

export const headQuery = {
  query: 'HEAD 10 from 1500',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "head"
      { offset: 4, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 5, type: PPLTokenTypes.Number, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "10"
      { offset: 7, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 8, type: PPLTokenTypes.Keyword, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "from"
      { offset: 12, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 13, type: PPLTokenTypes.Number, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "1500"
    ],
  ] as monacoTypes.Token[][],
};
export const rareQuery = {
  query: 'RARE server, ingestionTime by region, user',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "rare"
      { offset: 4, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 5, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "server"
      { offset: 11, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 12, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 13, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "ingestionTime"
      { offset: 26, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 27, type: PPLTokenTypes.Keyword, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "by"
      { offset: 29, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 30, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "region"
      { offset: 36, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 37, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 38, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "user"
    ],
  ] as monacoTypes.Token[][],
};

export const evalQuery = {
  query:
    'EVAL total_revenue = price * quantity, discount_price = price >= 0.9, revenue_category = IF(price BETWEEN 100 AND 200, "high", "low")',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "eval"
      { offset: 4, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 5, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "total_revenue"
      { offset: 18, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 19, type: PPLTokenTypes.Operator, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 20, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 21, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "price"
      { offset: 26, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 27, type: PPLTokenTypes.Operator, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "*"
      { offset: 28, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 29, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "quantity"
      { offset: 37, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 38, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 39, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "discount_price"
      { offset: 53, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 54, type: PPLTokenTypes.Operator, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 55, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 56, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "price"
      { offset: 61, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 62, type: PPLTokenTypes.Operator, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ">="
      { offset: 64, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 65, type: PPLTokenTypes.Number, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "0.9"
      { offset: 68, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 69, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 70, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "revenue_category"
      { offset: 86, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 87, type: PPLTokenTypes.Operator, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 88, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 89, type: PPLTokenTypes.Function, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "IF"
      { offset: 91, type: PPLTokenTypes.Parenthesis, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
      { offset: 92, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "price"
      { offset: 97, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 98, type: PPLTokenTypes.Keyword, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "between"
      { offset: 105, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 106, type: PPLTokenTypes.Number, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "100"
    ],
  ] as monacoTypes.Token[][],
};

export const parseQuery = {
  query: 'parse email ".+@(?<host>.+)"',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "parse"
      { offset: 5, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 6, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "email"
      { offset: 11, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 12, type: PPLTokenTypes.String, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // '".+@(?<host>.+)"
    ],
  ] as monacoTypes.Token[][],
};
export const queryWithArithmeticOps = {
  query: 'where price * discount >= 200',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "where"
      { offset: 5, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 6, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "price"
      { offset: 11, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 12, type: PPLTokenTypes.Operator, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "*"
      { offset: 13, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 14, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "discount"
      { offset: 22, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 23, type: PPLTokenTypes.Operator, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ">="
      { offset: 25, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 26, type: PPLTokenTypes.Number, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "200"
    ],
  ] as monacoTypes.Token[][],
};
export const queryWithLogicalExpression = {
  query: 'where orders = "shipped" OR NOT /returned/ AND price > 20',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "where"
      { offset: 5, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 6, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "orders"
      { offset: 12, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 13, type: PPLTokenTypes.Operator, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 14, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 15, type: PPLTokenTypes.String, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "'shipped'"
      { offset: 24, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 25, type: PPLTokenTypes.Operator, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "OR"
      { offset: 27, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 28, type: PPLTokenTypes.Operator, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "NOT"
      { offset: 31, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 32, type: PPLTokenTypes.Regexp, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "/returned/"
      { offset: 42, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 43, type: PPLTokenTypes.Operator, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "AND"
      { offset: 46, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 47, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "price"
      { offset: 52, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 53, type: PPLTokenTypes.Operator, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ">"
      { offset: 54, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 55, type: PPLTokenTypes.Number, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "20"
    ],
  ] as monacoTypes.Token[][],
};
export const queryWithFieldList = {
  query: 'fields ingestionTime, timestamp, `@server`, bytesReceived',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "fields"
      { offset: 6, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 7, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "ingestionTime"
      { offset: 20, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 21, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 22, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "timestamp"
      { offset: 31, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 32, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 33, type: PPLTokenTypes.Backtick, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "`@server`"
      { offset: 42, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 43, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 44, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "bytesReceived"
    ],
  ] as monacoTypes.Token[][],
};

export const queryWithFunctionCalls = {
  query: 'where like(dstAddr, ) where logType = "Tracing"| where cos(`duration`), right(`duration`)',
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Command, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "where"
      { offset: 5, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 6, type: PPLTokenTypes.Function, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "like"
      { offset: 10, type: PPLTokenTypes.Parenthesis, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
      { offset: 11, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "dstAddr"
      { offset: 18, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 19, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 20, type: PPLTokenTypes.Parenthesis, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ")"
      { offset: 21, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 22, type: PPLTokenTypes.Keyword, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // where
      { offset: 27, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 28, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // logType
      { offset: 35, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 36, type: PPLTokenTypes.Operator, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // =
      { offset: 37, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 38, type: PPLTokenTypes.String, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "Tracing"
      { offset: 47, type: PPLTokenTypes.Pipe, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "|"
      { offset: 48, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ""
      { offset: 49, type: PPLTokenTypes.Command, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "where"
      { offset: 54, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 55, type: PPLTokenTypes.Function, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "cos"
      { offset: 58, type: PPLTokenTypes.Parenthesis, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
      { offset: 59, type: PPLTokenTypes.Backtick, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "`duration`"
      { offset: 69, type: PPLTokenTypes.Parenthesis, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ")"
      { offset: 70, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 71, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 72, type: PPLTokenTypes.Function, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "right"
      { offset: 77, type: PPLTokenTypes.Parenthesis, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
    ],
  ] as monacoTypes.Token[][],
};
