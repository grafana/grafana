import { Token } from 'monaco-editor/esm/vs/editor/editor.api';

import { CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID } from '../../language/logs/definition';

export const commentOnlyQuery = {
  query: `# comment ending with whitespace     `,
  tokens: [[new Token(0, `comment.${CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID}`, CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID)]],
};
