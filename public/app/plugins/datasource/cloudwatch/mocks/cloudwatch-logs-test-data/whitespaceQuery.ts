import { monacoTypes } from '@grafana/ui';

import { LogsTokenTypes } from '../../language/logs/completion/types';
import { CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID } from '../../language/logs/definition';

export const logsTestDataWhitespaceOnlyQuery = {
  query: `   `,
  tokens: [
    [{ offset: 0, type: LogsTokenTypes.Whitespace, language: CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID }],
  ] as monacoTypes.Token[][],
};
