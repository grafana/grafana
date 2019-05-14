import * as tslib_1 from "tslib";
import PluginPrism from 'app/features/explore/slate-plugins/prism';
import BracesPlugin from 'app/features/explore/slate-plugins/braces';
import ClearPlugin from 'app/features/explore/slate-plugins/clear';
import NewlinePlugin from 'app/features/explore/slate-plugins/newline';
import RunnerPlugin from 'app/features/explore/slate-plugins/runner';
import Typeahead from './typeahead';
import { getKeybindingSrv } from 'app/core/services/keybindingSrv';
import { Block, Document, Text, Value } from 'slate';
import { Editor } from 'slate-react';
import Plain from 'slate-plain-serializer';
import ReactDOM from 'react-dom';
import React from 'react';
import _ from 'lodash';
function flattenSuggestions(s) {
    return s ? s.reduce(function (acc, g) { return acc.concat(g.items); }, []) : [];
}
export var makeFragment = function (text) {
    var lines = text.split('\n').map(function (line) {
        return Block.create({
            type: 'paragraph',
            nodes: [Text.create(line)],
        });
    });
    var fragment = Document.create({
        nodes: lines,
    });
    return fragment;
};
export var getInitialValue = function (query) { return Value.create({ document: makeFragment(query) }); };
var Portal = /** @class */ (function (_super) {
    tslib_1.__extends(Portal, _super);
    function Portal(props) {
        var _this = _super.call(this, props) || this;
        var _a = props.index, index = _a === void 0 ? 0 : _a, _b = props.prefix, prefix = _b === void 0 ? 'query' : _b;
        _this.node = document.createElement('div');
        _this.node.classList.add("slate-typeahead", "slate-typeahead-" + prefix + "-" + index);
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
}(React.Component));
var QueryField = /** @class */ (function (_super) {
    tslib_1.__extends(QueryField, _super);
    function QueryField(props, context) {
        var _this = _super.call(this, props, context) || this;
        _this.keybindingSrv = getKeybindingSrv();
        _this.onChange = function (_a) {
            var value = _a.value;
            var changed = value.document !== _this.state.value.document;
            _this.setState({ value: value }, function () {
                if (changed) {
                    // call typeahead only if query changed
                    requestAnimationFrame(function () { return _this.onTypeahead(); });
                    _this.onChangeQuery();
                }
            });
        };
        _this.request = function (url) {
            if (_this.props.request) {
                return _this.props.request(url);
            }
            return fetch(url);
        };
        _this.onChangeQuery = function () {
            // Send text change to parent
            var onQueryChange = _this.props.onQueryChange;
            if (onQueryChange) {
                onQueryChange(Plain.serialize(_this.state.value));
            }
        };
        _this.onKeyDown = function (event, change) {
            var _a = _this.state, typeaheadIndex = _a.typeaheadIndex, suggestions = _a.suggestions;
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
                        _this.onTypeahead(true);
                        return true;
                    }
                    break;
                }
                case 'Tab':
                case 'Enter': {
                    if (_this.menuEl) {
                        // Dont blur input
                        event.preventDefault();
                        if (!suggestions || suggestions.length === 0) {
                            return undefined;
                        }
                        // Get the currently selected suggestion
                        var flattenedSuggestions = flattenSuggestions(suggestions);
                        var selected = Math.abs(typeaheadIndex);
                        var selectedIndex = selected % flattenedSuggestions.length || 0;
                        var suggestion = flattenedSuggestions[selectedIndex];
                        _this.applyTypeahead(change, suggestion);
                        return true;
                    }
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
        _this.onTypeahead = function (change, item) {
            return change || _this.state.value.change();
        };
        _this.resetTypeahead = function () {
            _this.setState({
                suggestions: [],
                typeaheadIndex: 0,
                typeaheadPrefix: '',
                typeaheadContext: null,
            });
        };
        _this.handleBlur = function () {
            var onBlur = _this.props.onBlur;
            // If we dont wait here, menu clicks wont work because the menu
            // will be gone.
            _this.resetTimer = setTimeout(_this.resetTypeahead, 100);
            if (onBlur) {
                onBlur();
            }
            _this.restoreEscapeKeyBinding();
        };
        _this.handleFocus = function () {
            var onFocus = _this.props.onFocus;
            if (onFocus) {
                onFocus();
            }
            // Don't go back to dashboard if Escape pressed inside the editor.
            _this.removeEscapeKeyBinding();
        };
        _this.onClickItem = function (item) {
            var suggestions = _this.state.suggestions;
            if (!suggestions || suggestions.length === 0) {
                return;
            }
            // Get the currently selected suggestion
            var flattenedSuggestions = flattenSuggestions(suggestions);
            var suggestion = _.find(flattenedSuggestions, function (suggestion) { return suggestion.display === item || suggestion.text === item; });
            // Manually triggering change
            var change = _this.applyTypeahead(_this.state.value.change(), suggestion);
            _this.onChange(change);
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
            var hasSuggesstions = suggestions && suggestions.length > 0;
            if (!hasSuggesstions) {
                menu.removeAttribute('style');
                return;
            }
            // Align menu overlay to editor node
            if (node && node.parentElement) {
                // Read from DOM
                var rect = node.parentElement.getBoundingClientRect();
                var scrollX_1 = window.scrollX;
                var scrollY_1 = window.scrollY;
                var screenHeight = window.innerHeight;
                var menuLeft_1 = rect.left + scrollX_1 - 2;
                var menuTop_1 = rect.top + scrollY_1 + rect.height + 4;
                var menuHeight_1 = screenHeight - menuTop_1 - 10;
                // Write DOM
                requestAnimationFrame(function () {
                    menu.style.opacity = 1;
                    menu.style.top = menuTop_1 + "px";
                    menu.style.left = menuLeft_1 + "px";
                    menu.style.maxHeight = menuHeight_1 + "px";
                });
            }
        };
        _this.menuRef = function (el) {
            _this.menuEl = el;
        };
        _this.renderMenu = function () {
            var portalPrefix = _this.props.portalPrefix;
            var suggestions = _this.state.suggestions;
            var hasSuggesstions = suggestions && suggestions.length > 0;
            if (!hasSuggesstions) {
                return null;
            }
            // Guard selectedIndex to be within the length of the suggestions
            var selectedIndex = Math.max(_this.state.typeaheadIndex, 0);
            var flattenedSuggestions = flattenSuggestions(suggestions);
            selectedIndex = selectedIndex % flattenedSuggestions.length || 0;
            var selectedKeys = (flattenedSuggestions.length > 0 ? [flattenedSuggestions[selectedIndex]] : []).map(function (i) {
                return typeof i === 'object' ? i.text : i;
            });
            // Create typeahead in DOM root so we can later position it absolutely
            return (React.createElement(Portal, { prefix: portalPrefix },
                React.createElement(Typeahead, { menuRef: _this.menuRef, selectedItems: selectedKeys, onClickItem: _this.onClickItem, groupedItems: suggestions })));
        };
        var _a = props.prismDefinition, prismDefinition = _a === void 0 ? {} : _a, _b = props.prismLanguage, prismLanguage = _b === void 0 ? 'kusto' : _b;
        _this.plugins = [
            BracesPlugin(),
            ClearPlugin(),
            RunnerPlugin({ handler: props.onPressEnter }),
            NewlinePlugin(),
            PluginPrism({ definition: prismDefinition, language: prismLanguage }),
        ];
        _this.state = {
            labelKeys: {},
            labelValues: {},
            suggestions: [],
            typeaheadIndex: 0,
            typeaheadPrefix: '',
            value: getInitialValue(props.initialQuery || ''),
        };
        return _this;
    }
    QueryField.prototype.componentDidMount = function () {
        this.updateMenu();
    };
    QueryField.prototype.componentWillUnmount = function () {
        this.restoreEscapeKeyBinding();
        clearTimeout(this.resetTimer);
    };
    QueryField.prototype.componentDidUpdate = function () {
        this.updateMenu();
    };
    QueryField.prototype.applyTypeahead = function (change, suggestion) {
        return { value: {} };
    };
    QueryField.prototype.removeEscapeKeyBinding = function () {
        this.keybindingSrv.unbind('esc', 'keydown');
    };
    QueryField.prototype.restoreEscapeKeyBinding = function () {
        this.keybindingSrv.setupGlobal();
    };
    QueryField.prototype.render = function () {
        return (React.createElement("div", { className: "slate-query-field" },
            this.renderMenu(),
            React.createElement(Editor, { autoCorrect: false, onBlur: this.handleBlur, onKeyDown: this.onKeyDown, onChange: this.onChange, onFocus: this.handleFocus, placeholder: this.props.placeholder, plugins: this.plugins, spellCheck: false, value: this.state.value })));
    };
    return QueryField;
}(React.Component));
export default QueryField;
//# sourceMappingURL=query_field.js.map