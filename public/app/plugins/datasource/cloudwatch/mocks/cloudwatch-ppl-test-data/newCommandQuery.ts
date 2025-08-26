import { monacoTypes } from '@grafana/ui';

import { CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID } from '../../language/cloudwatch-ppl/language';
import { PPLTokenTypes } from '../../language/cloudwatch-ppl/tokenTypes';

export const newCommandQuery = {
  query: `fields timestamp | `,
  tokens: [
    [
      { offset: 0, type: PPLTokenTypes.Keyword, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID },
      { offset: 6, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID },
      { offset: 7, type: PPLTokenTypes.Identifier, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID },
      { offset: 16, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID },
      { offset: 17, type: PPLTokenTypes.Pipe, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID },
      { offset: 18, type: PPLTokenTypes.Whitespace, language: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID },
    ],
  ] as monacoTypes.Token[][],
};
