import { Token } from 'monaco-editor/esm/vs/editor/editor.api';

import { LogsTokenTypes } from '../../language/logs/completion/types';
import { CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID } from '../../language/logs/definition';

export const filterQuery = {
  query: `filter logGroup `,
  tokens: [
    [
      new Token(0, LogsTokenTypes.Keyword, CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID),
      new Token(6, LogsTokenTypes.Whitespace, CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID),
      new Token(7, LogsTokenTypes.Identifier, CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID),
      new Token(15, LogsTokenTypes.Whitespace, CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID),
    ],
  ],
  position: { lineNumber: 1, column: 16 },
};
