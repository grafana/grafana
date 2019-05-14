import * as tslib_1 from "tslib";
import _ from 'lodash';
import React from 'react';
import ReactDOM from 'react-dom';
import { Editor } from 'slate-react';
import Plain from 'slate-plain-serializer';
import classnames from 'classnames';
import ClearPlugin from './slate-plugins/clear';
import NewlinePlugin from './slate-plugins/newline';
import Typeahead from './Typeahead';
import { makeFragment, makeValue } from './Value';
import PlaceholdersBuffer from './PlaceholdersBuffer';
export var TYPEAHEAD_DEBOUNCE = 100;
function getSuggestionByIndex(suggestions, index) {
    // Flatten suggestion groups
    var flattenedSuggestions = suggestions.reduce(function (acc, g) { return acc.concat(g.items); }, []);
    var correctedIndex = Math.max(index, 0) % flattenedSuggestions.length;
    return flattenedSuggestions[correctedIndex];
}
function hasSuggestions(suggestions) {
    return suggestions && suggestions.length > 0;
}
/**
 * Renders an editor field.
 * Pass initial value as initialQuery and listen to changes in props.onValueChanged.
 * This component can only process strings. Internally it uses Slate Value.
 * Implement props.onTypeahead to use suggestions, see PromQueryField.tsx as an example.
 */
var QueryField = /** @class */ (function (_super) {
    tslib_1.__extends(QueryField, _super);
    function QueryField(props, context) {
        var _this = _super.call(this, props, context) || this;
        _this.onChange = function (_a, invokeParentOnValueChanged) {
            var value = _a.value;
            var documentChanged = value.document !== _this.state.value.document;
            var prevValue = _this.state.value;
            // Control editor loop, then pass text change up to parent
            _this.setState({ value: value }, function () {
                if (documentChanged) {
                    var textChanged = Plain.serialize(prevValue) !== Plain.serialize(value);
                    if (textChanged && invokeParentOnValueChanged) {
                        _this.executeOnQueryChangeAndExecuteQueries();
                    }
                }
            });
            // Show suggest menu on text input
            if (documentChanged && value.selection.isCollapsed) {
                // Need one paint to allow DOM-based typeahead rules to work
                window.requestAnimationFrame(_this.handleTypeahead);
            }
            else if (!_this.resetTimer) {
                _this.resetTypeahead();
            }
        };
        _this.executeOnQueryChangeAndExecuteQueries = function () {
            // Send text change to parent
            var _a = _this.props, onQueryChange = _a.onQueryChange, onExecuteQuery = _a.onExecuteQuery;
            if (onQueryChange) {
                onQueryChange(Plain.serialize(_this.state.value));
            }
            if (onExecuteQuery) {
                onExecuteQuery();
                _this.setState({ lastExecutedValue: _this.state.value });
            }
        };
        _this.handleTypeahead = _.debounce(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var selection, _a, cleanText, onTypeahead, value, wrapperNode, editorNode, range, offset, text, prefix_1, labelValueMatch, _b, suggestions, context, refresher_1, filteredSuggestions;
            var _this = this;
            return tslib_1.__generator(this, function (_c) {
                selection = window.getSelection();
                _a = this.props, cleanText = _a.cleanText, onTypeahead = _a.onTypeahead;
                value = this.state.value;
                if (onTypeahead && selection.anchorNode) {
                    wrapperNode = selection.anchorNode.parentElement;
                    editorNode = wrapperNode.closest('.slate-query-field');
                    if (!editorNode || this.state.value.isBlurred) {
                        // Not inside this editor
                        return [2 /*return*/];
                    }
                    range = selection.getRangeAt(0);
                    offset = range.startOffset;
                    text = selection.anchorNode.textContent;
                    prefix_1 = text.substr(0, offset);
                    labelValueMatch = prefix_1.match(/(?:!?=~?"?|")(.*)/);
                    if (labelValueMatch) {
                        prefix_1 = labelValueMatch[1];
                    }
                    else if (cleanText) {
                        prefix_1 = cleanText(prefix_1);
                    }
                    _b = onTypeahead({
                        editorNode: editorNode,
                        prefix: prefix_1,
                        selection: selection,
                        text: text,
                        value: value,
                        wrapperNode: wrapperNode,
                    }), suggestions = _b.suggestions, context = _b.context, refresher_1 = _b.refresher;
                    filteredSuggestions = suggestions
                        .map(function (group) {
                        if (group.items) {
                            if (prefix_1) {
                                // Filter groups based on prefix
                                if (!group.skipFilter) {
                                    group.items = group.items.filter(function (c) { return (c.filterText || c.label).length >= prefix_1.length; });
                                    if (group.prefixMatch) {
                                        group.items = group.items.filter(function (c) { return (c.filterText || c.label).indexOf(prefix_1) === 0; });
                                    }
                                    else {
                                        group.items = group.items.filter(function (c) { return (c.filterText || c.label).indexOf(prefix_1) > -1; });
                                    }
                                }
                                // Filter out the already typed value (prefix) unless it inserts custom text
                                group.items = group.items.filter(function (c) { return c.insertText || (c.filterText || c.label) !== prefix_1; });
                            }
                            if (!group.skipSort) {
                                group.items = _.sortBy(group.items, function (item) { return item.sortText || item.label; });
                            }
                        }
                        return group;
                    })
                        .filter(function (group) { return group.items && group.items.length > 0; });
                    // Keep same object for equality checking later
                    if (_.isEqual(filteredSuggestions, this.state.suggestions)) {
                        filteredSuggestions = this.state.suggestions;
                    }
                    this.setState({
                        suggestions: filteredSuggestions,
                        typeaheadPrefix: prefix_1,
                        typeaheadContext: context,
                        typeaheadText: text,
                    }, function () {
                        if (refresher_1) {
                            refresher_1.then(_this.handleTypeahead).catch(function (e) { return console.error(e); });
                        }
                    });
                }
                return [2 /*return*/];
            });
        }); }, TYPEAHEAD_DEBOUNCE);
        _this.handleEnterAndTabKey = function (change) {
            var _a = _this.state, typeaheadIndex = _a.typeaheadIndex, suggestions = _a.suggestions;
            if (_this.menuEl) {
                // Dont blur input
                event.preventDefault();
                if (!suggestions || suggestions.length === 0) {
                    return undefined;
                }
                var suggestion = getSuggestionByIndex(suggestions, typeaheadIndex);
                var nextChange = _this.applyTypeahead(change, suggestion);
                var insertTextOperation = nextChange.operations.find(function (operation) { return operation.type === 'insert_text'; });
                if (insertTextOperation) {
                    var suggestionText = insertTextOperation.text;
                    _this.placeholdersBuffer.setNextPlaceholderValue(suggestionText);
                    if (_this.placeholdersBuffer.hasPlaceholders()) {
                        nextChange.move(_this.placeholdersBuffer.getNextMoveOffset()).focus();
                    }
                }
                return true;
            }
            else {
                _this.executeOnQueryChangeAndExecuteQueries();
                return undefined;
            }
        };
        _this.onKeyDown = function (event, change) {
            var typeaheadIndex = _this.state.typeaheadIndex;
            switch (event.key) {
                case 'Escape': {
                    if (_this.menuEl) {
                        event.preventDefault();
                        event.stopPropagation();
                        _this.resetTypeahead();
                        return true;
                    }
                    break;
                }
                case ' ': {
                    if (event.ctrlKey) {
                        event.preventDefault();
                        _this.handleTypeahead();
                        return true;
                    }
                    break;
                }
                case 'Enter':
                case 'Tab': {
                    return _this.handleEnterAndTabKey(change);
                    break;
                }
                case 'ArrowDown': {
                    if (_this.menuEl) {
                        // Select next suggestion
                        event.preventDefault();
                        _this.setState({ typeaheadIndex: typeaheadIndex + 1 });
                    }
                    break;
                }
                case 'ArrowUp': {
                    if (_this.menuEl) {
                        // Select previous suggestion
                        event.preventDefault();
                        _this.setState({ typeaheadIndex: Math.max(0, typeaheadIndex - 1) });
                    }
                    break;
                }
                default: {
                    // console.log('default key', event.key, event.which, event.charCode, event.locale, data.key);
                    break;
                }
            }
            return undefined;
        };
        _this.resetTypeahead = function () {
            if (_this.mounted) {
                _this.setState({ suggestions: [], typeaheadIndex: 0, typeaheadPrefix: '', typeaheadContext: null });
                _this.resetTimer = null;
            }
        };
        _this.handleBlur = function (event, change) {
            var lastExecutedValue = _this.state.lastExecutedValue;
            var previousValue = lastExecutedValue ? Plain.serialize(_this.state.lastExecutedValue) : null;
            var currentValue = Plain.serialize(change.value);
            // If we dont wait here, menu clicks wont work because the menu
            // will be gone.
            _this.resetTimer = setTimeout(_this.resetTypeahead, 100);
            // Disrupting placeholder entry wipes all remaining placeholders needing input
            _this.placeholdersBuffer.clearPlaceholders();
            if (previousValue !== currentValue) {
                _this.executeOnQueryChangeAndExecuteQueries();
            }
        };
        _this.handleFocus = function () { };
        _this.onClickMenu = function (item) {
            // Manually triggering change
            var change = _this.applyTypeahead(_this.state.value.change(), item);
            _this.onChange(change, true);
        };
        _this.updateMenu = function () {
            var suggestions = _this.state.suggestions;
            var menu = _this.menuEl;
            var selection = window.getSelection();
            var node = selection.anchorNode;
            // No menu, nothing to do
            if (!menu) {
                return;
            }
            // No suggestions or blur, remove menu
            if (!hasSuggestions(suggestions)) {
                menu.removeAttribute('style');
                return;
            }
            // Align menu overlay to editor node
            if (node) {
                // Read from DOM
                var rect_1 = node.parentElement.getBoundingClientRect();
                var scrollX_1 = window.scrollX;
                var scrollY_1 = window.scrollY;
                // Write DOM
                requestAnimationFrame(function () {
                    menu.style.opacity = '1';
                    menu.style.top = rect_1.top + scrollY_1 + rect_1.height + 4 + "px";
                    menu.style.left = rect_1.left + scrollX_1 - 2 + "px";
                });
            }
        };
        _this.menuRef = function (el) {
            _this.menuEl = el;
        };
        _this.renderMenu = function () {
            var portalOrigin = _this.props.portalOrigin;
            var _a = _this.state, suggestions = _a.suggestions, typeaheadIndex = _a.typeaheadIndex, typeaheadPrefix = _a.typeaheadPrefix;
            if (!hasSuggestions(suggestions)) {
                return null;
            }
            var selectedItem = getSuggestionByIndex(suggestions, typeaheadIndex);
            // Create typeahead in DOM root so we can later position it absolutely
            return (React.createElement(Portal, { origin: portalOrigin },
                React.createElement(Typeahead, { menuRef: _this.menuRef, selectedItem: selectedItem, onClickItem: _this.onClickMenu, prefix: typeaheadPrefix, groupedItems: suggestions })));
        };
        _this.handlePaste = function (event, change) {
            var pastedValue = event.clipboardData.getData('Text');
            var newValue = change.value.change().insertText(pastedValue);
            _this.onChange(newValue);
            return true;
        };
        _this.placeholdersBuffer = new PlaceholdersBuffer(props.initialQuery || '');
        // Base plugins
        _this.plugins = tslib_1.__spread([ClearPlugin(), NewlinePlugin()], (props.additionalPlugins || [])).filter(function (p) { return p; });
        _this.state = {
            suggestions: [],
            typeaheadContext: null,
            typeaheadIndex: 0,
            typeaheadPrefix: '',
            typeaheadText: '',
            value: makeValue(_this.placeholdersBuffer.toString(), props.syntax),
            lastExecutedValue: null,
        };
        return _this;
    }
    QueryField.prototype.componentDidMount = function () {
        this.mounted = true;
        this.updateMenu();
    };
    QueryField.prototype.componentWillUnmount = function () {
        this.mounted = false;
        clearTimeout(this.resetTimer);
    };
    QueryField.prototype.componentDidUpdate = function (prevProps, prevState) {
        var _a = this.props, initialQuery = _a.initialQuery, syntax = _a.syntax;
        var _b = this.state, value = _b.value, suggestions = _b.suggestions;
        // if query changed from the outside
        if (initialQuery !== prevProps.initialQuery) {
            // and we have a version that differs
            if (initialQuery !== Plain.serialize(value)) {
                this.placeholdersBuffer = new PlaceholdersBuffer(initialQuery || '');
                this.setState({ value: makeValue(this.placeholdersBuffer.toString(), syntax) });
            }
        }
        // Only update menu location when suggestion existence or text/selection changed
        if (value !== prevState.value || hasSuggestions(suggestions) !== hasSuggestions(prevState.suggestions)) {
            this.updateMenu();
        }
    };
    QueryField.prototype.componentWillReceiveProps = function (nextProps) {
        if (nextProps.syntaxLoaded && !this.props.syntaxLoaded) {
            // Need a bogus edit to re-render the editor after syntax has fully loaded
            var change = this.state.value
                .change()
                .insertText(' ')
                .deleteBackward();
            if (this.placeholdersBuffer.hasPlaceholders()) {
                change.move(this.placeholdersBuffer.getNextMoveOffset()).focus();
            }
            this.onChange(change, true);
        }
    };
    QueryField.prototype.applyTypeahead = function (change, suggestion) {
        var _a = this.props, cleanText = _a.cleanText, onWillApplySuggestion = _a.onWillApplySuggestion, syntax = _a.syntax;
        var _b = this.state, typeaheadPrefix = _b.typeaheadPrefix, typeaheadText = _b.typeaheadText;
        var suggestionText = suggestion.insertText || suggestion.label;
        var preserveSuffix = suggestion.kind === 'function';
        var move = suggestion.move || 0;
        if (onWillApplySuggestion) {
            suggestionText = onWillApplySuggestion(suggestionText, tslib_1.__assign({}, this.state));
        }
        this.resetTypeahead();
        // Remove the current, incomplete text and replace it with the selected suggestion
        var backward = suggestion.deleteBackwards || typeaheadPrefix.length;
        var text = cleanText ? cleanText(typeaheadText) : typeaheadText;
        var suffixLength = text.length - typeaheadPrefix.length;
        var offset = typeaheadText.indexOf(typeaheadPrefix);
        var midWord = typeaheadPrefix && ((suffixLength > 0 && offset > -1) || suggestionText === typeaheadText);
        var forward = midWord && !preserveSuffix ? suffixLength + offset : 0;
        // If new-lines, apply suggestion as block
        if (suggestionText.match(/\n/)) {
            var fragment = makeFragment(suggestionText, syntax);
            return change
                .deleteBackward(backward)
                .deleteForward(forward)
                .insertFragment(fragment)
                .focus();
        }
        return change
            .deleteBackward(backward)
            .deleteForward(forward)
            .insertText(suggestionText)
            .move(move)
            .focus();
    };
    QueryField.prototype.render = function () {
        var disabled = this.props.disabled;
        var wrapperClassName = classnames('slate-query-field__wrapper', {
            'slate-query-field__wrapper--disabled': disabled,
        });
        return (React.createElement("div", { className: wrapperClassName },
            React.createElement("div", { className: "slate-query-field" },
                this.renderMenu(),
                React.createElement(Editor, { autoCorrect: false, readOnly: this.props.disabled, onBlur: this.handleBlur, onKeyDown: this.onKeyDown, onChange: this.onChange, onFocus: this.handleFocus, onPaste: this.handlePaste, placeholder: this.props.placeholder, plugins: this.plugins, spellCheck: false, value: this.state.value }))));
    };
    return QueryField;
}(React.PureComponent));
export { QueryField };
var Portal = /** @class */ (function (_super) {
    tslib_1.__extends(Portal, _super);
    function Portal(props) {
        var _this = _super.call(this, props) || this;
        var _a = props.index, index = _a === void 0 ? 0 : _a, _b = props.origin, origin = _b === void 0 ? 'query' : _b;
        _this.node = document.createElement('div');
        _this.node.classList.add("slate-typeahead", "slate-typeahead-" + origin + "-" + index);
        document.body.appendChild(_this.node);
        return _this;
    }
    Portal.prototype.componentWillUnmount = function () {
        document.body.removeChild(this.node);
    };
    Portal.prototype.render = function () {
        return ReactDOM.createPortal(this.props.children, this.node);
    };
    return Portal;
}(React.PureComponent));
export default QueryField;
//# sourceMappingURL=QueryField.js.map