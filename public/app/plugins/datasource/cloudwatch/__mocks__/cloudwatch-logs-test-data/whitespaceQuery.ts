import { Token } from 'monaco-editor/esm/vs/editor/editor.api';

import { LogsTokenTypes } from '../../language/logs/completion/types';
import { CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID } from '../../language/logs/definition';

export const whitespaceOnlyQuery = {
  query: `   `,
  tokens: [[new Token(0, LogsTokenTypes.Whitespace, CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID)]],
};
