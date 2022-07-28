import type { monacoTypes } from '@grafana/ui';

import { TokenType } from '../types';

import { LinkedToken } from './LinkedToken';
import { Monaco } from './types';

export function linkedTokenBuilder(
  monaco: Monaco,
  model: monacoTypes.editor.ITextModel,
  position: monacoTypes.IPosition,
  languageId = 'sql'
) {
  let current: LinkedToken | null = null;
  let previous: LinkedToken | null = null;
  const tokensPerLine = monaco.editor.tokenize(model.getValue() ?? '', languageId);
  for (let lineIndex = 0; lineIndex < tokensPerLine.length; lineIndex++) {
    const tokens = tokensPerLine[lineIndex];
    // In case position is first column in new line, add empty whitespace token so that links are not broken
    if (!tokens.length && previous) {
      const token: monacoTypes.Token = {
        offset: 0,
        type: TokenType.Whitespace,
        language: languageId,
        _tokenBrand: undefined,
      };
      tokens.push(token);
    }

    for (let columnIndex = 0; columnIndex < tokens.length; columnIndex++) {
      const token = tokens[columnIndex];
      let endColumn =
        tokens.length > columnIndex + 1 ? tokens[columnIndex + 1].offset + 1 : model.getLineLength(lineIndex + 1) + 1;

      const range: monacoTypes.IRange = {
        startLineNumber: lineIndex + 1,
        startColumn: token.offset === 0 ? 0 : token.offset + 1,
        endLineNumber: lineIndex + 1,
        endColumn,
      };

      const value = model.getValueInRange(range);
      const sqlToken: LinkedToken = new LinkedToken(token.type, value, range, previous, null);

      if (monaco.Range.containsPosition(range, position)) {
        current = sqlToken;
      }

      if (previous) {
        previous.next = sqlToken;
      }
      previous = sqlToken;
    }
  }
  return current;
}
