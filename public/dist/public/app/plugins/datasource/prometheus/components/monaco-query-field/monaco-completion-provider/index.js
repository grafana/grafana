import { getIntent } from './intent';
import { getCompletions } from './completions';
import { NeverCaseError } from './util';
function getMonacoCompletionItemKind(type, monaco) {
    switch (type) {
        case 'DURATION':
            return monaco.languages.CompletionItemKind.Unit;
        case 'FUNCTION':
            return monaco.languages.CompletionItemKind.Variable;
        case 'HISTORY':
            return monaco.languages.CompletionItemKind.Snippet;
        case 'LABEL_NAME':
            return monaco.languages.CompletionItemKind.Enum;
        case 'LABEL_VALUE':
            return monaco.languages.CompletionItemKind.EnumMember;
        case 'METRIC_NAME':
            return monaco.languages.CompletionItemKind.Constructor;
        default:
            throw new NeverCaseError(type);
    }
}
export function getCompletionProvider(monaco, dataProvider) {
    var provideCompletionItems = function (model, position) {
        var word = model.getWordAtPosition(position);
        var range = word != null
            ? monaco.Range.lift({
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn,
            })
            : monaco.Range.fromPositions(position);
        // documentation says `position` will be "adjusted" in `getOffsetAt`
        // i don't know what that means, to be sure i clone it
        var positionClone = {
            column: position.column,
            lineNumber: position.lineNumber,
        };
        var offset = model.getOffsetAt(positionClone);
        var intent = getIntent(model.getValue(), offset);
        var completionsPromise = intent != null ? getCompletions(intent, dataProvider) : Promise.resolve([]);
        return completionsPromise.then(function (items) {
            // monaco by-default alphabetically orders the items.
            // to stop it, we use a number-as-string sortkey,
            // so that monaco keeps the order we use
            var maxIndexDigits = items.length.toString().length;
            var suggestions = items.map(function (item, index) { return ({
                kind: getMonacoCompletionItemKind(item.type, monaco),
                label: item.label,
                insertText: item.insertText,
                detail: item.detail,
                documentation: item.documentation,
                sortText: index.toString().padStart(maxIndexDigits, '0'),
                range: range,
                command: item.triggerOnInsert
                    ? {
                        id: 'editor.action.triggerSuggest',
                        title: '',
                    }
                    : undefined,
            }); });
            return { suggestions: suggestions };
        });
    };
    return {
        triggerCharacters: ['{', ',', '[', '(', '=', '~', ' '],
        provideCompletionItems: provideCompletionItems,
    };
}
//# sourceMappingURL=index.js.map