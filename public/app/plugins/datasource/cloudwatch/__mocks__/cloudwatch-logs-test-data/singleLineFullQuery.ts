import { Token } from 'monaco-editor/esm/vs/editor/editor.api';

import { LogsTokenTypes } from '../../language/logs/completion/types';
import { CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID } from '../../language/logs/definition';

export const singleLineFullQuery = {
  query: `fields @timestamp, @message | limit 20 # this is a comment`,
  tokens: [
    [
      new Token(0, LogsTokenTypes.Keyword, CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID),
      new Token(6, LogsTokenTypes.Whitespace, CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID),
      new Token(7, LogsTokenTypes.Identifier, CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID),
      new Token(17, LogsTokenTypes.Delimiter, CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID),
      new Token(18, LogsTokenTypes.Whitespace, CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID),
      new Token(19, LogsTokenTypes.Identifier, CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID),
      new Token(27, LogsTokenTypes.Whitespace, CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID),
      new Token(28, LogsTokenTypes.Delimiter, CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID),
      new Token(29, LogsTokenTypes.Whitespace, CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID),
      new Token(30, LogsTokenTypes.Keyword, CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID),
      new Token(35, LogsTokenTypes.Whitespace, CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID),
      new Token(36, LogsTokenTypes.Number, CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID),
      new Token(38, LogsTokenTypes.Whitespace, CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID),
      new Token(39, `comment.${CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID}`, CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID),
    ],
  ],
};
