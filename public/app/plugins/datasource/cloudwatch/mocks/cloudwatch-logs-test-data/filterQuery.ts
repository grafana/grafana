import { monacoTypes } from '@grafana/ui';

import { LogsTokenTypes } from '../../language/logs/completion/types';
import { CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID } from '../../language/logs/definition';

export const logsTestDataFilterQuery = {
  query: `filter logGroup `,
  tokens: [
    [
      { offset: 0, type: LogsTokenTypes.Keyword, language: CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID },
      { offset: 6, type: LogsTokenTypes.Whitespace, language: CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID },
      { offset: 7, type: LogsTokenTypes.Identifier, language: CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID },
      { offset: 15, type: LogsTokenTypes.Whitespace, language: CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID },
    ],
  ] as monacoTypes.Token[][],
  position: { lineNumber: 1, column: 16 },
};
