import { monacoTypes } from '@grafana/ui';

import { CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID } from '../../language/cloudwatch-ppl/language';
import { PPLTokenTypes } from '../../language/cloudwatch-ppl/tokenTypes';

export const multiLineNewCommandQuery = {
  query: `fields ingestionTime, level 
  | `,
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Keyword, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID },
      { offset: 7, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID },
      { offset: 8, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID },
      { offset: 21, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID },
      { offset: 22, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID },
      { offset: 23, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID },
    ],
    [
      { offset: 0, type: PPLTokenTypes.Pipe, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID },
      { offset: 1, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID },
    ],
  ] as monacoTypes.Token[][],
};
export const multiLineFullQuery = {
  query: `fields ingestionTime, level
| WHERE like(\`@message\`, "%Exception%") AND not like(server, "test")
| FIELDS + \`@ingestionTime\`, timestamp, table
| stats avg(timestamp) as exceptionCount by span(\`@timestamp\`, 1h)
| EVENTSTATS avg(timestamp) as exceptionCount by span(\`@timestamp\`, 1h)
| sort - DisconnectReason, + timestamp, server
| sort - AUTO(DisconnectReason)
| DEDUP 5 timestamp, ingestionTime, \`@query\` keepempty = true consecutive = false
| DEDUP timestamp, ingestionTime, \`@query\`
| TOP 100 ingestionTime, timestamp by server, region
| HEAD 10 from 1500
| RARE server, ingestionTime by region, user
| EVAL total_revenue = price * quantity, discount_price = price >= 0.9, revenue_category = IF(price > 100, 'high', 'low')
| parse email ".+@(?<host>.+)"'`,
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Keyword, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID },
      { offset: 6, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID },
      { offset: 7, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID },
      { offset: 20, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID },
      { offset: 21, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID },
      { offset: 22, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID },
    ],
    [
      { offset: 0, type: PPLTokenTypes.Pipe, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "|"
      { offset: 1, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 2, type: PPLTokenTypes.Command, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "WHERE"
      { offset: 7, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 8, type: PPLTokenTypes.Function, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "like"
      { offset: 12, type: PPLTokenTypes.Parenthesis, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
      { offset: 13, type: PPLTokenTypes.Backtick, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "`@message`"
      { offset: 23, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 24, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 25, type: PPLTokenTypes.String, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "%Exception"
      { offset: 38, type: PPLTokenTypes.Parenthesis, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ")"
      { offset: 39, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 40, type: PPLTokenTypes.Operator, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "and"
      { offset: 43, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 44, type: PPLTokenTypes.Operator, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "not"
      { offset: 47, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 48, type: PPLTokenTypes.Function, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "like"
    ],
    [
      { offset: 0, type: PPLTokenTypes.Pipe, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "|"
      { offset: 1, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 2, type: PPLTokenTypes.Command, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "fields"
      { offset: 8, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 9, type: PPLTokenTypes.Operator, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "+"
      { offset: 10, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 11, type: PPLTokenTypes.Backtick, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "@ingestionTime"
      { offset: 27, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 28, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " ",
      { offset: 29, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "timestamp",
      { offset: 38, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 39, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 40, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "table"
    ],
    [
      { offset: 0, type: PPLTokenTypes.Pipe, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "|"
      { offset: 1, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 2, type: PPLTokenTypes.Command, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "stats"
      { offset: 7, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 8, type: PPLTokenTypes.Function, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "avg"
      { offset: 11, type: PPLTokenTypes.Parenthesis, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
      { offset: 12, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "timestamp",
      { offset: 21, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ")",
      { offset: 22, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 23, type: PPLTokenTypes.Keyword, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "as"
      { offset: 25, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 26, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "exceptionCount"
      { offset: 40, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 41, type: PPLTokenTypes.Keyword, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "by"
      { offset: 43, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 44, type: PPLTokenTypes.Function, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "span"
      { offset: 48, type: PPLTokenTypes.Parenthesis, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
      { offset: 49, type: PPLTokenTypes.Backtick, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "@timestmap"
      { offset: 61, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 62, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 63, type: PPLTokenTypes.Number, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "1"
      { offset: 64, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, //"h"
    ],
    [
      { offset: 0, type: PPLTokenTypes.Pipe, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "|"
      { offset: 1, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 2, type: PPLTokenTypes.Command, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "eventstats"
      { offset: 12, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 13, type: PPLTokenTypes.Function, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "avg"
      { offset: 16, type: PPLTokenTypes.Parenthesis, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
      { offset: 17, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "timestamp",
      { offset: 26, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ")",
      { offset: 27, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 28, type: PPLTokenTypes.Keyword, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "as"
      { offset: 30, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 31, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "exceptionCount"
      { offset: 45, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 46, type: PPLTokenTypes.Keyword, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "by"
      { offset: 48, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 49, type: PPLTokenTypes.Function, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "span"
      { offset: 53, type: PPLTokenTypes.Parenthesis, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
      { offset: 54, type: PPLTokenTypes.Backtick, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "@timestmap"
      { offset: 66, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 67, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 68, type: PPLTokenTypes.Number, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "1"
    ],
    [
      { offset: 0, type: PPLTokenTypes.Pipe, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "|"
      { offset: 1, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 2, type: PPLTokenTypes.Command, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "sort"
      { offset: 6, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 7, type: PPLTokenTypes.Operator, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "-"
      { offset: 8, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 9, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "DisconnectReason"
      { offset: 25, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 26, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 27, type: PPLTokenTypes.Operator, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "+"
      { offset: 28, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 29, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "timestamp"
      { offset: 38, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 39, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 40, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "server"
    ],
    [
      { offset: 0, type: PPLTokenTypes.Pipe, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "|"
      { offset: 1, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 2, type: PPLTokenTypes.Command, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "sort"
      { offset: 6, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 7, type: PPLTokenTypes.Operator, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "-"
      { offset: 8, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 9, type: PPLTokenTypes.Function, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "AUTO"
      { offset: 13, type: PPLTokenTypes.Parenthesis, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
      { offset: 14, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "DisconnectReason"
      { offset: 30, type: PPLTokenTypes.Parenthesis, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ")"
    ],
    [
      { offset: 0, type: PPLTokenTypes.Pipe, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "|"
      { offset: 1, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 2, type: PPLTokenTypes.Command, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "dedup"
      { offset: 7, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 8, type: PPLTokenTypes.Number, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "5"
      { offset: 9, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 10, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "timestamp"
      { offset: 19, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 20, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 21, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "ingestionTime"
      { offset: 34, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 35, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 36, type: PPLTokenTypes.Backtick, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "`@query`"
      { offset: 44, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 45, type: PPLTokenTypes.Keyword, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "keepempty"
      { offset: 54, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 55, type: PPLTokenTypes.Operator, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 56, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 57, type: PPLTokenTypes.Keyword, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "true"
      { offset: 61, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 62, type: PPLTokenTypes.Keyword, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "consecutive"
      { offset: 73, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 74, type: PPLTokenTypes.Operator, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 75, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 76, type: PPLTokenTypes.Keyword, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "false"
    ],
    [
      { offset: 0, type: PPLTokenTypes.Pipe, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "|"
      { offset: 1, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 2, type: PPLTokenTypes.Command, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "dedup"
      { offset: 7, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 8, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "timestamp"
      { offset: 17, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 18, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 19, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "ingestionTime"
      { offset: 32, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 33, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 34, type: PPLTokenTypes.Backtick, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "`@query`"
    ],
    [
      { offset: 0, type: PPLTokenTypes.Pipe, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "|"
      { offset: 1, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 2, type: PPLTokenTypes.Command, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "top"
      { offset: 5, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 6, type: PPLTokenTypes.Number, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "100"
      { offset: 9, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 10, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "ingestionTime"
      { offset: 23, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 24, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 25, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "timestamp"
      { offset: 34, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 35, type: PPLTokenTypes.Keyword, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "by"
      { offset: 37, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 38, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "server"
      { offset: 44, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 45, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 46, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "region"
    ],
    [
      { offset: 0, type: PPLTokenTypes.Pipe, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "|"
      { offset: 1, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 2, type: PPLTokenTypes.Command, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "head"
      { offset: 6, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 7, type: PPLTokenTypes.Number, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "10"
      { offset: 9, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 10, type: PPLTokenTypes.Keyword, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "from"
      { offset: 14, type: PPLTokenTypes.Number, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 15, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "1500"
    ],
    [
      { offset: 0, type: PPLTokenTypes.Pipe, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "|"
      { offset: 1, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 2, type: PPLTokenTypes.Command, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "rare"
      { offset: 6, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 7, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "server"
      { offset: 13, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 14, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 15, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "ingestionTime"
      { offset: 28, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, //
      { offset: 29, type: PPLTokenTypes.Keyword, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "by"
      { offset: 31, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 32, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "region"
      { offset: 38, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 39, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 40, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "user"
    ],
    [
      { offset: 0, type: PPLTokenTypes.Pipe, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "|"
      { offset: 1, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 2, type: PPLTokenTypes.Command, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "eval"
      { offset: 6, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 7, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "total_revenue"
      { offset: 20, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 21, type: PPLTokenTypes.Operator, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 22, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 23, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "price"
      { offset: 28, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 29, type: PPLTokenTypes.Operator, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "*"
      { offset: 30, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 31, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "quantity"
      { offset: 39, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 40, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 41, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "discount_price"
      { offset: 55, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 56, type: PPLTokenTypes.Operator, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 57, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 58, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "price"
      { offset: 63, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 64, type: PPLTokenTypes.Operator, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ">="
      { offset: 66, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 67, type: PPLTokenTypes.Number, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "0.9"
      { offset: 70, type: PPLTokenTypes.Delimiter, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ","
      { offset: 71, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 72, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "revenue_category"
      { offset: 88, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 89, type: PPLTokenTypes.Operator, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "="
      { offset: 90, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 91, type: PPLTokenTypes.Function, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "IF"
      { offset: 93, type: PPLTokenTypes.Parenthesis, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "("
      { offset: 94, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "price"
      { offset: 99, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 100, type: PPLTokenTypes.Operator, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // ">"
      { offset: 101, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 102, type: PPLTokenTypes.Number, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "100"
    ],
    [
      { offset: 0, type: PPLTokenTypes.Pipe, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "|"
      { offset: 1, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 2, type: PPLTokenTypes.Command, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "parse"
      { offset: 7, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 8, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // "email"
      { offset: 13, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // " "
      { offset: 14, type: PPLTokenTypes.String, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID }, // '".+@(?<host>.+)"
    ],
  ] as monacoTypes.Token[][],
};
