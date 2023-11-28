import { __awaiter } from "tslib";
/**
 * Class that implements CompletionItemProvider interface and allows us to provide suggestion for the Monaco
 * autocomplete system.
 */
export class CompletionProvider {
    constructor(props) {
        this.triggerCharacters = ['=', ' '];
        this.cachedValues = {};
        this.languageProvider = props.languageProvider;
    }
    provideCompletionItems(model, position) {
        var _a;
        // Should not happen, this should not be called before it is initialized
        if (!(this.monaco && this.editor)) {
            throw new Error('provideCompletionItems called before CompletionProvider was initialized');
        }
        // if the model-id does not match, then this call is from a different editor-instance,
        // not "our instance", so return nothing
        if (((_a = this.editor.getModel()) === null || _a === void 0 ? void 0 : _a.id) !== model.id) {
            return { suggestions: [] };
        }
        const { range, offset } = getRangeAndOffset(this.monaco, model, position);
        const situation = this.getSituation(model.getValue(), offset);
        const completionItems = this.getCompletions(situation);
        return completionItems.then((items) => {
            // monaco by-default alphabetically orders the items.
            // to stop it, we use a number-as-string sortkey,
            // so that monaco keeps the order we use
            const maxIndexDigits = items.length.toString().length;
            const suggestions = items.map((item, index) => {
                const suggestion = {
                    kind: getMonacoCompletionItemKind(item.type, this.monaco),
                    label: item.label,
                    insertText: item.insertText,
                    sortText: index.toString().padStart(maxIndexDigits, '0'),
                    range,
                };
                return suggestion;
            });
            return { suggestions };
        });
    }
    getTagValues(tagName) {
        return __awaiter(this, void 0, void 0, function* () {
            let tagValues;
            if (this.cachedValues.hasOwnProperty(tagName)) {
                tagValues = this.cachedValues[tagName];
            }
            else {
                tagValues = yield this.languageProvider.getOptionsV1(tagName);
                this.cachedValues[tagName] = tagValues;
            }
            return tagValues;
        });
    }
    /**
     * Get suggestion based on the situation we are in like whether we should suggest tag names or values.
     * @param situation
     * @private
     */
    getCompletions(situation) {
        return __awaiter(this, void 0, void 0, function* () {
            switch (situation.type) {
                // Not really sure what would make sense to suggest in this case so just leave it
                case 'UNKNOWN': {
                    return [];
                }
                case 'EMPTY': {
                    return this.getTagsCompletions();
                }
                case 'IN_NAME':
                    return this.getTagsCompletions();
                case 'IN_VALUE':
                    const tagValues = yield this.getTagValues(situation.tagName);
                    const items = [];
                    const getInsertionText = (val) => `"${val.label}"`;
                    tagValues.forEach((val) => {
                        if (val === null || val === void 0 ? void 0 : val.label) {
                            items.push({
                                label: val.label,
                                insertText: getInsertionText(val),
                                type: 'TAG_VALUE',
                            });
                        }
                    });
                    return items;
                default:
                    throw new Error(`Unexpected situation ${situation}`);
            }
        });
    }
    getTagsCompletions() {
        const tags = this.languageProvider.getAutocompleteTags();
        return tags
            .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'accent' }))
            .map((key) => ({
            label: key,
            insertText: key,
            type: 'TAG_NAME',
        }));
    }
    /**
     * Figure out where is the cursor and what kind of suggestions are appropriate.
     * @param text
     * @param offset
     */
    getSituation(text, offset) {
        var _a, _b;
        if (text === '' || offset === 0 || text[text.length - 1] === ' ') {
            return {
                type: 'EMPTY',
            };
        }
        const textUntilCaret = text.substring(0, offset);
        const regex = /(?<key>[^= ]+)(?<equals>=)?(?<value>([^ "]+)|"([^"]*)")?/;
        const matches = textUntilCaret.match(new RegExp(regex, 'g'));
        if (matches === null || matches === void 0 ? void 0 : matches.length) {
            const last = matches[matches.length - 1];
            const lastMatched = last.match(regex);
            if (lastMatched) {
                const key = (_a = lastMatched.groups) === null || _a === void 0 ? void 0 : _a.key;
                const equals = (_b = lastMatched.groups) === null || _b === void 0 ? void 0 : _b.equals;
                if (!key) {
                    return {
                        type: 'EMPTY',
                    };
                }
                if (!equals) {
                    return {
                        type: 'IN_NAME',
                    };
                }
                return {
                    type: 'IN_VALUE',
                    tagName: key,
                };
            }
        }
        return {
            type: 'EMPTY',
        };
    }
}
/**
 * Get item kind which is used for icon next to the suggestion.
 * @param type
 * @param monaco
 */
function getMonacoCompletionItemKind(type, monaco) {
    switch (type) {
        case 'TAG_NAME':
            return monaco.languages.CompletionItemKind.Enum;
        case 'KEYWORD':
            return monaco.languages.CompletionItemKind.Keyword;
        case 'OPERATOR':
            return monaco.languages.CompletionItemKind.Operator;
        case 'TAG_VALUE':
            return monaco.languages.CompletionItemKind.EnumMember;
        case 'SCOPE':
            return monaco.languages.CompletionItemKind.Class;
        default:
            throw new Error(`Unexpected CompletionType: ${type}`);
    }
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