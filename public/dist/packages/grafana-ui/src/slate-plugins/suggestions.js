import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { debounce, sortBy } from 'lodash';
import TOKEN_MARK from './slate-prism/TOKEN_MARK';
import { Typeahead } from '../components/Typeahead/Typeahead';
import { makeFragment, SearchFunctionType } from '../utils';
import { SearchFunctionMap } from '../utils/searchFunctions';
export var TYPEAHEAD_DEBOUNCE = 250;
export function SuggestionsPlugin(_a) {
    var onTypeahead = _a.onTypeahead, cleanText = _a.cleanText, onWillApplySuggestion = _a.onWillApplySuggestion, portalOrigin = _a.portalOrigin;
    var typeaheadRef;
    var state = {
        groupedItems: [],
        typeaheadPrefix: '',
        typeaheadContext: '',
        typeaheadText: '',
    };
    var handleTypeaheadDebounced = debounce(handleTypeahead, TYPEAHEAD_DEBOUNCE);
    var setState = function (update) {
        state = __assign(__assign({}, state), update);
    };
    return {
        onBlur: function (event, editor, next) {
            state = __assign(__assign({}, state), { groupedItems: [] });
            return next();
        },
        onClick: function (event, editor, next) {
            state = __assign(__assign({}, state), { groupedItems: [] });
            return next();
        },
        onKeyDown: function (event, editor, next) {
            var keyEvent = event;
            var currentSuggestions = state.groupedItems;
            var hasSuggestions = currentSuggestions.length;
            switch (keyEvent.key) {
                case 'Escape': {
                    if (hasSuggestions) {
                        keyEvent.preventDefault();
                        state = __assign(__assign({}, state), { groupedItems: [] });
                        // Bogus edit to re-render editor
                        return editor.insertText('');
                    }
                    break;
                }
                case 'ArrowDown':
                case 'ArrowUp':
                    if (hasSuggestions) {
                        keyEvent.preventDefault();
                        typeaheadRef.moveMenuIndex(keyEvent.key === 'ArrowDown' ? 1 : -1);
                        return;
                    }
                    break;
                case 'Enter': {
                    if (!(keyEvent.shiftKey || keyEvent.ctrlKey) && hasSuggestions) {
                        keyEvent.preventDefault();
                        return typeaheadRef.insertSuggestion();
                    }
                    break;
                }
                case 'Tab': {
                    if (hasSuggestions) {
                        keyEvent.preventDefault();
                        return typeaheadRef.insertSuggestion();
                    }
                    break;
                }
                default: {
                    // Don't react on meta keys
                    if (keyEvent.key.length === 1) {
                        handleTypeaheadDebounced(editor, setState, onTypeahead, cleanText);
                    }
                    break;
                }
            }
            return next();
        },
        commands: {
            selectSuggestion: function (editor, suggestion) {
                var suggestions = state.groupedItems;
                if (!suggestions || !suggestions.length) {
                    return editor;
                }
                // @ts-ignore
                var ed = editor.applyTypeahead(suggestion);
                handleTypeaheadDebounced(editor, setState, onTypeahead, cleanText);
                return ed;
            },
            applyTypeahead: function (editor, suggestion) {
                var suggestionText = suggestion.insertText || suggestion.label;
                var preserveSuffix = suggestion.kind === 'function';
                var move = suggestion.move || 0;
                var typeaheadPrefix = state.typeaheadPrefix, typeaheadText = state.typeaheadText, typeaheadContext = state.typeaheadContext;
                if (onWillApplySuggestion) {
                    suggestionText = onWillApplySuggestion(suggestionText, {
                        groupedItems: state.groupedItems,
                        typeaheadContext: typeaheadContext,
                        typeaheadPrefix: typeaheadPrefix,
                        typeaheadText: typeaheadText,
                    });
                }
                // Remove the current, incomplete text and replace it with the selected suggestion
                var backward = suggestion.deleteBackwards || typeaheadPrefix.length;
                var text = cleanText ? cleanText(typeaheadText) : typeaheadText;
                var suffixLength = text.length - typeaheadPrefix.length;
                var offset = typeaheadText.indexOf(typeaheadPrefix);
                var midWord = typeaheadPrefix && ((suffixLength > 0 && offset > -1) || suggestionText === typeaheadText);
                var forward = midWord && !preserveSuffix ? suffixLength + offset : 0;
                // If new-lines, apply suggestion as block
                if (suggestionText.match(/\n/)) {
                    var fragment = makeFragment(suggestionText);
                    return editor.deleteBackward(backward).deleteForward(forward).insertFragment(fragment).focus();
                }
                state = __assign(__assign({}, state), { groupedItems: [] });
                return editor
                    .deleteBackward(backward)
                    .deleteForward(forward)
                    .insertText(suggestionText)
                    .moveForward(move)
                    .focus();
            },
        },
        renderEditor: function (props, editor, next) {
            if (editor.value.selection.isExpanded) {
                return next();
            }
            var children = next();
            return (React.createElement(React.Fragment, null,
                children,
                React.createElement(Typeahead, { menuRef: function (menu) { return (typeaheadRef = menu); }, origin: portalOrigin, prefix: state.typeaheadPrefix, isOpen: !!state.groupedItems.length, groupedItems: state.groupedItems, onSelectSuggestion: editor.selectSuggestion })));
        },
    };
}
var handleTypeahead = function (editor, onStateChange, onTypeahead, cleanText) { return __awaiter(void 0, void 0, void 0, function () {
    var value, selection, parentBlock, selectionStartOffset, decorations, filteredDecorations, labelKeyDec, labelKey, wrapperClasses, text, prefix, labelValueMatch, _a, suggestions, context, filteredSuggestions;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                if (!onTypeahead) {
                    return [2 /*return*/];
                }
                value = editor.value;
                selection = value.selection;
                parentBlock = value.document.getClosestBlock(value.focusBlock.key);
                selectionStartOffset = value.selection.start.offset - 1;
                decorations = parentBlock && parentBlock.getDecorations(editor);
                filteredDecorations = decorations
                    ? decorations
                        .filter(function (decoration) {
                        return decoration.start.offset <= selectionStartOffset &&
                            decoration.end.offset > selectionStartOffset &&
                            decoration.type === TOKEN_MARK;
                    })
                        .toArray()
                    : [];
                labelKeyDec = decorations &&
                    decorations
                        .filter(function (decoration) {
                        return decoration.end.offset <= selectionStartOffset &&
                            decoration.type === TOKEN_MARK &&
                            decoration.data.get('className').includes('label-key');
                    })
                        .last();
                labelKey = labelKeyDec && value.focusText.text.slice(labelKeyDec.start.offset, labelKeyDec.end.offset);
                wrapperClasses = filteredDecorations
                    .map(function (decoration) { return decoration.data.get('className'); })
                    .join(' ')
                    .split(' ')
                    .filter(function (className) { return className.length; });
                text = value.focusText.text;
                prefix = text.slice(0, selection.focus.offset);
                if (filteredDecorations.length) {
                    text = value.focusText.text.slice(filteredDecorations[0].start.offset, filteredDecorations[0].end.offset);
                    prefix = value.focusText.text.slice(filteredDecorations[0].start.offset, selection.focus.offset);
                }
                labelValueMatch = prefix.match(/(?:!?=~?"?|")(.*)/);
                if (labelValueMatch) {
                    prefix = labelValueMatch[1];
                }
                else if (cleanText) {
                    prefix = cleanText(prefix);
                }
                return [4 /*yield*/, onTypeahead({
                        prefix: prefix,
                        text: text,
                        value: value,
                        wrapperClasses: wrapperClasses,
                        labelKey: labelKey || undefined,
                        editor: editor,
                    })];
            case 1:
                _a = _b.sent(), suggestions = _a.suggestions, context = _a.context;
                filteredSuggestions = suggestions
                    .map(function (group) {
                    if (!group.items) {
                        return group;
                    }
                    // Falling back to deprecated prefixMatch to support backwards compatibility with plugins using this property
                    var searchFunctionType = group.searchFunctionType || (group.prefixMatch ? SearchFunctionType.Prefix : SearchFunctionType.Word);
                    var searchFunction = SearchFunctionMap[searchFunctionType];
                    var newGroup = __assign({}, group);
                    if (prefix) {
                        // Filter groups based on prefix
                        if (!group.skipFilter) {
                            newGroup.items = newGroup.items.filter(function (c) { return (c.filterText || c.label).length >= prefix.length; });
                            newGroup.items = searchFunction(newGroup.items, prefix);
                        }
                        // Filter out the already typed value (prefix) unless it inserts custom text not matching the prefix
                        newGroup.items = newGroup.items.filter(function (c) { var _a; return !(c.insertText === prefix || ((_a = c.filterText) !== null && _a !== void 0 ? _a : c.label) === prefix); });
                    }
                    if (!group.skipSort) {
                        newGroup.items = sortBy(newGroup.items, function (item) {
                            if (item.sortText === undefined) {
                                return item.sortValue !== undefined ? item.sortValue : item.label;
                            }
                            else {
                                // Falling back to deprecated sortText to support backwards compatibility with plugins using this property
                                return item.sortText || item.label;
                            }
                        });
                    }
                    return newGroup;
                })
                    .filter(function (gr) { return gr.items && gr.items.length; });
                onStateChange({
                    groupedItems: filteredSuggestions,
                    typeaheadPrefix: prefix,
                    typeaheadContext: context,
                    typeaheadText: text,
                });
                // Bogus edit to force re-render
                editor.blur().focus();
                return [2 /*return*/];
        }
    });
}); };
//# sourceMappingURL=suggestions.js.map