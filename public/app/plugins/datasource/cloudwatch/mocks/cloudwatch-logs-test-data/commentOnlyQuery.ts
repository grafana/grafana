import { monacoTypes } from '@grafana/ui';

import { LogsTokenTypes } from '../../language/logs/completion/types';
import { CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID } from '../../language/logs/definition';

export const logsTestDataCommentOnlyQuery = {
  query: `# comment ending with whitespace     `,
  tokens: [
    [{ offset: 0, type: LogsTokenTypes.Comment, language: CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID }],
  ] as monacoTypes.Token[][],
};
