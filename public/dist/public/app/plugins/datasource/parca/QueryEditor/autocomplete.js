import { __awaiter } from "tslib";
/**
 * Class that implements CompletionItemProvider interface and allows us to provide suggestion for the Monaco
 * autocomplete system.
 *
 * At this moment we just pass it all the labels/values we get from Fire backend later on we may do something a bit
 * smarter if there will be lots of labels.
 */
export class CompletionProvider {
    constructor(datasource, monaco, editor) {
        this.datasource = datasource;
        this.monaco = monaco;
        this.editor = editor;
        this.triggerCharacters = ['{', ',', '[', '(', '=', '~', ' ', '"'];
        this.labels = {};
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            const names = yield this.datasource.getLabelNames();
            this.labels = names.reduce((acc, name) => {
                acc[name] = [];
                return acc;
            }, {});
        });
    }
    provideCompletionItems(model, position) {
        var _a;
        // if the model-id does not match, then this call is from a different editor-instance,
        // not "our instance", so return nothing
        if (((_a = this.editor.getModel()) === null || _a === void 0 ? void 0 : _a.id) !== model.id) {
            return { suggestions: [] };
        }
        const { range, offset } = getRangeAndOffset(this.monaco, model, position);
        const situation = getSituation(model.getValue(), offset);
        // Cannot be async/await cause of the ProviderResult return type
        return this.getCompletions(situation).then((completionItems) => {
            // monaco by-default alphabetically orders the items.
            // to stop it, we use a number-as-string sortkey,
            // so that monaco keeps the order we use
            const maxIndexDigits = completionItems.length.toString().length;
            const suggestions = completionItems.map((item, index) => ({
                kind: getMonacoCompletionItemKind(item.type, this.monaco),
                label: item.label,
                insertText: item.insertText,
                sortText: index.toString().padStart(maxIndexDigits, '0'),
                range,
            }));
            return { suggestions };
        });
    }
    /**
     * Get suggestion based on the situation we are in like whether we should suggest label names or values.
     * @param situation
     * @private
     */
    getCompletions(situation) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Object.keys(this.labels).length) {
                return [];
            }
            switch (situation.type) {
                // Not really sure what would make sense to suggest in this case so just leave it
                case 'UNKNOWN': {
                    return [];
                }
                case 'EMPTY': {
                    return Object.keys(this.labels).map((key) => {
                        return {
                            label: key,
                            insertText: `{${key}="`,
                            type: 'LABEL_NAME',
                        };
                    });
                }
                case 'IN_LABEL_NAME':
                    return Object.keys(this.labels).map((key) => {
                        return {
                            label: key,
                            insertText: key,
                            type: 'LABEL_NAME',
                        };
                    });
                case 'IN_LABEL_VALUE':
                    let values = [];
                    if (this.labels[situation.labelName].length) {
                        values = this.labels[situation.labelName];
                    }
                    else {
                        values = yield this.datasource.getLabelValues(situation.labelName);
                        this.labels[situation.labelName] = values;
                    }
                    return values.map((val) => {
                        return {
                            label: val,
                            insertText: situation.betweenQuotes ? val : `"${val}"`,
                            type: 'LABEL_VALUE',
                        };
                    });
                default:
                    throw new Error(`Unexpected situation ${situation}`);
            }
        });
    }
}
/**
 * Get item kind which is used for icon next to the suggestion.
 * @param type
 * @param monaco
 */
function getMonacoCompletionItemKind(type, monaco) {
    switch (type) {
        case 'LABEL_NAME':
            return monaco.languages.CompletionItemKind.Enum;
        case 'LABEL_VALUE':
            return monaco.languages.CompletionItemKind.EnumMember;
        default:
            throw new Error(`Unexpected CompletionType: ${type}`);
    }
}
const labelNameRegex = /[a-zA-Z_][a-zA-Z0-9_]*/;
const labelValueRegex = /[^"]*/; // anything except a double quote
const labelPairsRegex = new RegExp(`(${labelNameRegex.source})="(${labelValueRegex.source})"`, 'g');
const inLabelValueRegex = new RegExp(`(${labelNameRegex.source})=("?)${labelValueRegex.source}$`);
const inLabelNameRegex = new RegExp(/[{,]\s*[a-zA-Z0-9_]*$/);
/**
 * Figure out where is the cursor and what kind of suggestions are appropriate.
 * As currently Fire handles just a simple {foo="bar", baz="zyx"} kind of values we can do with simple regex to figure
 * out where we are with the cursor.
 * @param text
 * @param offset
 */
function getSituation(text, offset) {
    if (text === '') {
        return {
            type: 'EMPTY',
        };
    }
    // Get all the labels so far in the query, so we can do some more filtering.
    const matches = text.matchAll(labelPairsRegex);
    const existingLabels = Array.from(matches).reduce((acc, match) => {
        const [_, name, value] = match[1];
        acc.push({ name, value });
        return acc;
    }, []);
    // Check if we are editing a label value right now. If so also get name of the label
    const matchLabelValue = text.substring(0, offset).match(inLabelValueRegex);
    if (matchLabelValue) {
        return {
            type: 'IN_LABEL_VALUE',
            labelName: matchLabelValue[1],
            betweenQuotes: !!matchLabelValue[2],
            otherLabels: existingLabels,
        };
    }
    // Check if we are editing a label name
    const matchLabelName = text.substring(0, offset).match(inLabelNameRegex);
    if (matchLabelName) {
        return {
            type: 'IN_LABEL_NAME',
            otherLabels: existingLabels,
        };
    }
    // Will happen only if user writes something that isn't really a label selector
    return {
        type: 'UNKNOWN',
    };
}
function getRangeAndOffset(monaco, model, position) {
    const word = model.getWordAtPosition(position);
    const range = word != null
        ? monaco.Range.lift({
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
        })
        : monaco.Range.fromPositions(position);
    // documentation says `position` will be "adjusted" in `getOffsetAt` so we clone it here just for sure.
    const positionClone = {
        column: position.column,
        lineNumber: position.lineNumber,
    };
    const offset = model.getOffsetAt(positionClone);
    return { offset, range };
}
//# sourceMappingURL=autocomplete.js.map