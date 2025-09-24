import { monacoTypes } from '@grafana/ui';

import { LogsTokenTypes } from '../../language/logs/completion/types';
import { CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID } from '../../language/logs/definition';

export const logsTestDataSingleLineFullQuery = {
  query: `fields @timestamp, @message | limit 20 # this is a comment`,
  tokens: [
    [
      { offset: 0, type: LogsTokenTypes.Keyword, language: CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID },
      { offset: 6, type: LogsTokenTypes.Whitespace, language: CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID },
      { offset: 7, type: LogsTokenTypes.Identifier, language: CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID },
      { offset: 17, type: LogsTokenTypes.Delimiter, language: CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID },
      { offset: 18, type: LogsTokenTypes.Whitespace, language: CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID },
      { offset: 19, type: LogsTokenTypes.Identifier, language: CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID },
      { offset: 27, type: LogsTokenTypes.Whitespace, language: CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID },
      { offset: 28, type: LogsTokenTypes.Delimiter, language: CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID },
      { offset: 29, type: LogsTokenTypes.Whitespace, language: CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID },
      { offset: 30, type: LogsTokenTypes.Keyword, language: CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID },
      { offset: 35, type: LogsTokenTypes.Whitespace, language: CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID },
      { offset: 36, type: LogsTokenTypes.Number, language: CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID },
      { offset: 38, type: LogsTokenTypes.Whitespace, language: CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID },
      { offset: 39, type: LogsTokenTypes.Comment, language: CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID },
    ],
  ] as monacoTypes.Token[][],
};
