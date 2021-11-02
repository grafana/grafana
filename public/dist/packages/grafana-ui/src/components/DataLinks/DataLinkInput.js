import { __assign, __makeTemplateObject, __read } from "tslib";
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import usePrevious from 'react-use/lib/usePrevious';
import { DataLinkSuggestions } from './DataLinkSuggestions';
import { makeValue } from '../../index';
import { SelectionReference } from './SelectionReference';
import { Portal } from '../index';
// @ts-ignore
import Prism from 'prismjs';
import { Editor } from '@grafana/slate-react';
import Plain from 'slate-plain-serializer';
import { Popper as ReactPopper } from 'react-popper';
import { css, cx } from '@emotion/css';
import { SlatePrism } from '../../slate-plugins';
import { SCHEMA } from '../../utils/slate';
import { useStyles2 } from '../../themes';
import { DataLinkBuiltInVars, VariableOrigin } from '@grafana/data';
import { getInputStyles } from '../Input/Input';
import CustomScrollbar from '../CustomScrollbar/CustomScrollbar';
var modulo = function (a, n) { return a - n * Math.floor(a / n); };
var datalinksSyntax = {
    builtInVariable: {
        pattern: /(\${\S+?})/,
    },
};
var plugins = [
    SlatePrism({
        onlyIn: function (node) { return node.type === 'code_block'; },
        getSyntax: function () { return 'links'; },
    }, __assign(__assign({}, Prism.languages), { links: datalinksSyntax })),
];
var getStyles = function (theme) { return ({
    input: getInputStyles({ theme: theme, invalid: false }).input,
    editor: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    .token.builtInVariable {\n      color: ", ";\n    }\n    .token.variable {\n      color: ", ";\n    }\n  "], ["\n    .token.builtInVariable {\n      color: ", ";\n    }\n    .token.variable {\n      color: ", ";\n    }\n  "])), theme.colors.success.text, theme.colors.primary.text),
    suggestionsWrapper: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    box-shadow: ", ";\n  "], ["\n    box-shadow: ", ";\n  "])), theme.shadows.z2),
    // Wrapper with child selector needed.
    // When classnames are applied to the same element as the wrapper, it causes the suggestions to stop working
    wrapperOverrides: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    width: 100%;\n    > .slate-query-field__wrapper {\n      padding: 0;\n      background-color: transparent;\n      border: none;\n    }\n  "], ["\n    width: 100%;\n    > .slate-query-field__wrapper {\n      padding: 0;\n      background-color: transparent;\n      border: none;\n    }\n  "]))),
}); };
// This memoised also because rerendering the slate editor grabs focus which created problem in some cases this
// was used and changes to different state were propagated here.
export var DataLinkInput = memo(function (_a) {
    var value = _a.value, onChange = _a.onChange, suggestions = _a.suggestions, _b = _a.placeholder, placeholder = _b === void 0 ? 'http://your-grafana.com/d/000000010/annotations' : _b;
    var editorRef = useRef();
    var styles = useStyles2(getStyles);
    var _c = __read(useState(false), 2), showingSuggestions = _c[0], setShowingSuggestions = _c[1];
    var _d = __read(useState(0), 2), suggestionsIndex = _d[0], setSuggestionsIndex = _d[1];
    var _e = __read(useState(makeValue(value)), 2), linkUrl = _e[0], setLinkUrl = _e[1];
    var prevLinkUrl = usePrevious(linkUrl);
    // Workaround for https://github.com/ianstormtaylor/slate/issues/2927
    var stateRef = useRef({ showingSuggestions: showingSuggestions, suggestions: suggestions, suggestionsIndex: suggestionsIndex, linkUrl: linkUrl, onChange: onChange });
    stateRef.current = { showingSuggestions: showingSuggestions, suggestions: suggestions, suggestionsIndex: suggestionsIndex, linkUrl: linkUrl, onChange: onChange };
    // Used to get the height of the suggestion elements in order to scroll to them.
    var activeRef = useRef(null);
    var activeIndexPosition = useMemo(function () { return getElementPosition(activeRef.current, suggestionsIndex); }, [
        suggestionsIndex,
    ]);
    // SelectionReference is used to position the variables suggestion relatively to current DOM selection
    var selectionRef = useMemo(function () { return new SelectionReference(); }, []);
    var onKeyDown = React.useCallback(function (event, next) {
        if (!stateRef.current.showingSuggestions) {
            if (event.key === '=' || event.key === '$' || (event.keyCode === 32 && event.ctrlKey)) {
                return setShowingSuggestions(true);
            }
            return next();
        }
        switch (event.key) {
            case 'Backspace':
            case 'Escape':
                setShowingSuggestions(false);
                return setSuggestionsIndex(0);
            case 'Enter':
                event.preventDefault();
                return onVariableSelect(stateRef.current.suggestions[stateRef.current.suggestionsIndex]);
            case 'ArrowDown':
            case 'ArrowUp':
                event.preventDefault();
                var direction_1 = event.key === 'ArrowDown' ? 1 : -1;
                return setSuggestionsIndex(function (index) { return modulo(index + direction_1, stateRef.current.suggestions.length); });
            default:
                return next();
        }
    }, []);
    useEffect(function () {
        // Update the state of the link in the parent. This is basically done on blur but we need to do it after
        // our state have been updated. The duplicity of state is done for perf reasons and also because local
        // state also contains things like selection and formating.
        if (prevLinkUrl && prevLinkUrl.selection.isFocused && !linkUrl.selection.isFocused) {
            stateRef.current.onChange(Plain.serialize(linkUrl));
        }
    }, [linkUrl, prevLinkUrl]);
    var onUrlChange = React.useCallback(function (_a) {
        var value = _a.value;
        setLinkUrl(value);
    }, []);
    var onVariableSelect = function (item, editor) {
        if (editor === void 0) { editor = editorRef.current; }
        var includeDollarSign = Plain.serialize(editor.value).slice(-1) !== '$';
        if (item.origin !== VariableOrigin.Template || item.value === DataLinkBuiltInVars.includeVars) {
            editor.insertText((includeDollarSign ? '$' : '') + "{" + item.value + "}");
        }
        else {
            editor.insertText("${" + item.value + ":queryparam}");
        }
        setLinkUrl(editor.value);
        setShowingSuggestions(false);
        setSuggestionsIndex(0);
        stateRef.current.onChange(Plain.serialize(editor.value));
    };
    return (React.createElement("div", { className: styles.wrapperOverrides },
        React.createElement("div", { className: "slate-query-field__wrapper" },
            React.createElement("div", { className: "slate-query-field" },
                showingSuggestions && (React.createElement(Portal, null,
                    React.createElement(ReactPopper, { referenceElement: selectionRef, placement: "bottom-end", modifiers: [
                            {
                                name: 'preventOverflow',
                                enabled: true,
                                options: {
                                    rootBoundary: 'viewport',
                                },
                            },
                            {
                                name: 'arrow',
                                enabled: false,
                            },
                            {
                                name: 'offset',
                                options: {
                                    offset: [250, 0],
                                },
                            },
                        ] }, function (_a) {
                        var ref = _a.ref, style = _a.style, placement = _a.placement;
                        return (React.createElement("div", { ref: ref, style: style, "data-placement": placement, className: styles.suggestionsWrapper },
                            React.createElement(CustomScrollbar, { scrollTop: activeIndexPosition, autoHeightMax: "300px" },
                                React.createElement(DataLinkSuggestions, { activeRef: activeRef, suggestions: stateRef.current.suggestions, onSuggestionSelect: onVariableSelect, onClose: function () { return setShowingSuggestions(false); }, activeIndex: suggestionsIndex }))));
                    }))),
                React.createElement(Editor, { schema: SCHEMA, ref: editorRef, placeholder: placeholder, value: stateRef.current.linkUrl, onChange: onUrlChange, onKeyDown: function (event, _editor, next) { return onKeyDown(event, next); }, plugins: plugins, className: cx(styles.editor, styles.input, css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n                  padding: 3px 8px;\n                "], ["\n                  padding: 3px 8px;\n                "])))) })))));
});
DataLinkInput.displayName = 'DataLinkInput';
function getElementPosition(suggestionElement, activeIndex) {
    var _a;
    return ((_a = suggestionElement === null || suggestionElement === void 0 ? void 0 : suggestionElement.clientHeight) !== null && _a !== void 0 ? _a : 0) * activeIndex;
}
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=DataLinkInput.js.map