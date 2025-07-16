import { monacoTypes } from '@grafana/ui';

import { LogsTokenTypes } from '../../language/logs/completion/types';
import { CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID } from '../../language/logs/definition';

export const logsTestDataSortQuery = {
  query: `fields @timestamp | sort `,
  tokens: [
    [
      { offset: 0, type: LogsTokenTypes.Keyword, language: CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID },
      { offset: 6, type: LogsTokenTypes.Whitespace, language: CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID },
      { offset: 7, type: LogsTokenTypes.Identifier, language: CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID },
      { offset: 17, type: LogsTokenTypes.Whitespace, language: CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID },
      { offset: 18, type: LogsTokenTypes.Delimiter, language: CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID },
      { offset: 19, type: LogsTokenTypes.Whitespace, language: CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID },
      { offset: 20, type: LogsTokenTypes.Keyword, language: CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID },
      { offset: 24, type: LogsTokenTypes.Whitespace, language: CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID },
    ],
  ] as monacoTypes.Token[][],
  position: { lineNumber: 1, column: 26 },
};
