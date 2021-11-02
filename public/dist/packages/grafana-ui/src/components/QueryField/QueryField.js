import { __extends, __read, __spreadArray } from "tslib";
import { debounce } from 'lodash';
import React from 'react';
import { Editor } from '@grafana/slate-react';
import Plain from 'slate-plain-serializer';
import classnames from 'classnames';
import { ClearPlugin, NewlinePlugin, SelectionShortcutsPlugin, IndentationPlugin, ClipboardPlugin, RunnerPlugin, SuggestionsPlugin, } from '../../slate-plugins';
import { makeValue, SCHEMA } from '../..';
import { selectors } from '@grafana/e2e-selectors';
/**
 * Renders an editor field.
 * Pass initial value as initialQuery and listen to changes in props.onValueChanged.
 * This component can only process strings. Internally it uses Slate Value.
 * Implement props.onTypeahead to use suggestions, see PromQueryField.tsx as an example.
 */
var QueryField = /** @class */ (function (_super) {
    __extends(QueryField, _super);
    function QueryField(props, context) {
        var _this = _super.call(this, props, context) || this;
        _this.lastExecutedValue = null;
        _this.mounted = false;
        _this.editor = null;
        /**
         * Update local state, propagate change upstream and optionally run the query afterwards.
         */
        _this.onChange = function (value, runQuery) {
            var documentChanged = value.document !== _this.state.value.document;
            var prevValue = _this.state.value;
            if (_this.props.onRichValueChange) {
                _this.props.onRichValueChange(value);
            }
            // Update local state with new value and optionally change value upstream.
            _this.setState({ value: value }, function () {
                // The diff is needed because the actual value of editor have much more metadata (for example text selection)
                // that is not passed upstream so every change of editor value does not mean change of the query text.
                if (documentChanged) {
                    var textChanged = Plain.serialize(prevValue) !== Plain.serialize(value);
                    if (textChanged && runQuery) {
                        _this.runOnChangeAndRunQuery();
                    }
                    if (textChanged && !runQuery) {
                        // Debounce change propagation by default for perf reasons.
                        _this.runOnChangeDebounced();
                    }
                }
            });
        };
        _this.runOnChange = function () {
            var onChange = _this.props.onChange;
            var value = Plain.serialize(_this.state.value);
            if (onChange) {
                onChange(_this.cleanText(value));
            }
        };
        _this.runOnRunQuery = function () {
            var onRunQuery = _this.props.onRunQuery;
            if (onRunQuery) {
                onRunQuery();
                _this.lastExecutedValue = _this.state.value;
            }
        };
        _this.runOnChangeAndRunQuery = function () {
            // onRunQuery executes query from Redux in Explore so it needs to be updated sync in case we want to run
            // the query.
            _this.runOnChange();
            _this.runOnRunQuery();
        };
        /**
         * We need to handle blur events here mainly because of dashboard panels which expect to have query executed on blur.
         */
        _this.handleBlur = function (event, editor, next) {
            var onBlur = _this.props.onBlur;
            if (onBlur) {
                onBlur();
            }
            else {
                // Run query by default on blur
                var previousValue = _this.lastExecutedValue ? Plain.serialize(_this.lastExecutedValue) : null;
                var currentValue = Plain.serialize(editor.value);
                if (previousValue !== currentValue) {
                    _this.runOnChangeAndRunQuery();
                }
            }
            return next();
        };
        _this.runOnChangeDebounced = debounce(_this.runOnChange, 500);
        var onTypeahead = props.onTypeahead, cleanText = props.cleanText, portalOrigin = props.portalOrigin, onWillApplySuggestion = props.onWillApplySuggestion;
        // Base plugins
        _this.plugins = __spreadArray([
            // SuggestionsPlugin and RunnerPlugin need to be before NewlinePlugin
            // because they override Enter behavior
            SuggestionsPlugin({ onTypeahead: onTypeahead, cleanText: cleanText, portalOrigin: portalOrigin, onWillApplySuggestion: onWillApplySuggestion }),
            RunnerPlugin({ handler: _this.runOnChangeAndRunQuery }),
            NewlinePlugin(),
            ClearPlugin(),
            SelectionShortcutsPlugin(),
            IndentationPlugin(),
            ClipboardPlugin()
        ], __read((props.additionalPlugins || [])), false).filter(function (p) { return p; });
        _this.state = {
            suggestions: [],
            typeaheadContext: null,
            typeaheadPrefix: '',
            typeaheadText: '',
            value: makeValue(props.query || '', props.syntax),
        };
        return _this;
    }
    QueryField.prototype.componentDidMount = function () {
        this.mounted = true;
    };
    QueryField.prototype.componentWillUnmount = function () {
        this.mounted = false;
    };
    QueryField.prototype.componentDidUpdate = function (prevProps, prevState) {
        var _a = this.props, query = _a.query, syntax = _a.syntax, syntaxLoaded = _a.syntaxLoaded;
        if (!prevProps.syntaxLoaded && syntaxLoaded && this.editor) {
            // Need a bogus edit to re-render the editor after syntax has fully loaded
            var editor = this.editor.insertText(' ').deleteBackward(1);
            this.onChange(editor.value, true);
        }
        var value = this.state.value;
        // Handle two way binging between local state and outside prop.
        // if query changed from the outside
        if (query !== prevProps.query) {
            // and we have a version that differs
            if (query !== Plain.serialize(value)) {
                this.setState({ value: makeValue(query || '', syntax) });
            }
        }
    };
    QueryField.prototype.cleanText = function (text) {
        // RegExp with invisible characters we want to remove - currently only carriage return (newlines are visible)
        var newText = text.replace(/[\r]/g, '');
        return newText;
    };
    QueryField.prototype.render = function () {
        var _this = this;
        var disabled = this.props.disabled;
        var wrapperClassName = classnames('slate-query-field__wrapper', {
            'slate-query-field__wrapper--disabled': disabled,
        });
        return (React.createElement("div", { className: wrapperClassName },
            React.createElement("div", { className: "slate-query-field", "aria-label": selectors.components.QueryField.container },
                React.createElement(Editor, { ref: function (editor) { return (_this.editor = editor); }, schema: SCHEMA, autoCorrect: false, readOnly: this.props.disabled, onBlur: this.handleBlur, onClick: this.props.onClick, 
                    // onKeyDown={this.onKeyDown}
                    onChange: function (change) {
                        _this.onChange(change.value, false);
                    }, placeholder: this.props.placeholder, plugins: this.plugins, spellCheck: false, value: this.state.value }))));
    };
    return QueryField;
}(React.PureComponent));
export { QueryField };
export default QueryField;
//# sourceMappingURL=QueryField.js.map