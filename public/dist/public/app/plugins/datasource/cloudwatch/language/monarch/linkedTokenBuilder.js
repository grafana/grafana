import { LinkedToken } from './LinkedToken';
export function linkedTokenBuilder(monaco, language, model, position, tokenTypes) {
    var _a;
    let current = null;
    let previous = null;
    const tokensPerLine = monaco.editor.tokenize((_a = model.getValue()) !== null && _a !== void 0 ? _a : '', language.id);
    for (let lineIndex = 0; lineIndex < tokensPerLine.length; lineIndex++) {
        const tokens = tokensPerLine[lineIndex];
        // In case position is first column in new line, add empty whitespace token so that links are not broken
        if (!tokens.length && previous) {
            const token = {
                offset: 0,
                type: tokenTypes.Whitespace,
                language: language.id,
                _tokenBrand: undefined,
            };
            tokens.push(token);
        }
        for (let columnIndex = 0; columnIndex < tokens.length; columnIndex++) {
            const token = tokens[columnIndex];
            let endColumn = tokens.length > columnIndex + 1 ? tokens[columnIndex + 1].offset + 1 : model.getLineLength(lineIndex + 1) + 1;
            const range = {
                startLineNumber: lineIndex + 1,
                startColumn: token.offset === 0 ? 0 : token.offset + 1,
                endLineNumber: lineIndex + 1,
                endColumn,
            };
            const value = model.getValueInRange(range);
            const newToken = new LinkedToken(token.type, value, range, previous, null, tokenTypes);
            if (monaco.Range.containsPosition(range, position)) {
                current = newToken;
            }
            if (previous) {
                previous.next = newToken;
            }
            previous = newToken;
        }
    }
    return current;
}
//# sourceMappingURL=linkedTokenBuilder.js.map