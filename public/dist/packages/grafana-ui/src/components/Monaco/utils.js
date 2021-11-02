import { CodeEditorSuggestionItemKind } from './types';
/**
 * @alpha
 */
export function variableSuggestionToCodeEditorSuggestion(sug) {
    var label = '${' + sug.value + '}';
    var detail = sug.value === sug.label ? sug.origin : sug.label + " / " + sug.origin;
    return {
        label: label,
        kind: CodeEditorSuggestionItemKind.Property,
        detail: detail,
        documentation: sug.documentation,
    };
}
//# sourceMappingURL=utils.js.map