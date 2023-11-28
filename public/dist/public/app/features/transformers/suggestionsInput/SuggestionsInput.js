import { css } from '@emotion/css';
import React, { useEffect, useRef, useState } from 'react';
import { Popper as ReactPopper } from 'react-popper';
import { CustomScrollbar, FieldValidationMessage, Input, Portal, useTheme2 } from '@grafana/ui';
import { DataLinkSuggestions } from '@grafana/ui/src/components/DataLinks/DataLinkSuggestions';
const modulo = (a, n) => a - n * Math.floor(a / n);
const ERROR_TOOLTIP_OFFSET = 8;
const getStyles = (theme, inputHeight) => {
    return {
        suggestionsWrapper: css({
            boxShadow: theme.shadows.z2,
        }),
        errorTooltip: css({
            position: 'absolute',
            top: inputHeight + ERROR_TOOLTIP_OFFSET + 'px',
            zIndex: theme.zIndex.tooltip,
        }),
        inputWrapper: css({
            position: 'relative',
        }),
        // Wrapper with child selector needed.
        // When classnames are applied to the same element as the wrapper, it causes the suggestions to stop working
    };
};
export const SuggestionsInput = ({ value = '', onChange, suggestions, placeholder, error, invalid, }) => {
    const [showingSuggestions, setShowingSuggestions] = useState(false);
    const [suggestionsIndex, setSuggestionsIndex] = useState(0);
    const [variableValue, setVariableValue] = useState(value.toString());
    const [scrollTop, setScrollTop] = useState(0);
    const [inputHeight, setInputHeight] = useState(0);
    const [startPos, setStartPos] = useState(0);
    const theme = useTheme2();
    const styles = getStyles(theme, inputHeight);
    const inputRef = useRef(null);
    // Used to get the height of the suggestion elements in order to scroll to them.
    const activeRef = useRef(null);
    useEffect(() => {
        setScrollTop(getElementPosition(activeRef.current, suggestionsIndex));
    }, [suggestionsIndex]);
    const onVariableSelect = React.useCallback((item, input = inputRef.current) => {
        const curPos = input.selectionStart;
        const x = input.value;
        if (x[startPos - 1] === '$') {
            input.value = x.slice(0, startPos) + item.value + x.slice(curPos);
        }
        else {
            input.value = x.slice(0, startPos) + '$' + item.value + x.slice(curPos);
        }
        setVariableValue(input.value);
        setShowingSuggestions(false);
        setSuggestionsIndex(0);
        onChange(input.value);
    }, [onChange, startPos]);
    const onKeyDown = React.useCallback((event) => {
        if (!showingSuggestions) {
            if (event.key === '$' || (event.key === ' ' && event.ctrlKey)) {
                setStartPos(inputRef.current.selectionStart || 0);
                setShowingSuggestions(true);
                return;
            }
            return;
        }
        switch (event.key) {
            case 'Backspace':
            case 'Escape':
            case 'ArrowLeft':
            case 'ArrowRight':
                setShowingSuggestions(false);
                return setSuggestionsIndex(0);
            case 'Enter':
                event.preventDefault();
                return onVariableSelect(suggestions[suggestionsIndex]);
            case 'ArrowDown':
            case 'ArrowUp':
                event.preventDefault();
                const direction = event.key === 'ArrowDown' ? 1 : -1;
                return setSuggestionsIndex((index) => modulo(index + direction, suggestions.length));
            default:
                return;
        }
    }, [showingSuggestions, suggestions, suggestionsIndex, onVariableSelect]);
    const onValueChanged = React.useCallback((event) => {
        setVariableValue(event.currentTarget.value);
    }, []);
    const onBlur = React.useCallback((event) => {
        onChange(event.currentTarget.value);
    }, [onChange]);
    useEffect(() => {
        setInputHeight(inputRef.current.clientHeight);
    }, []);
    return (React.createElement("div", { className: styles.inputWrapper },
        showingSuggestions && (React.createElement(Portal, null,
            React.createElement(ReactPopper, { referenceElement: inputRef.current, placement: "bottom-start", modifiers: [
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
                            offset: [0, 0],
                        },
                    },
                ] }, ({ ref, style, placement }) => {
                return (React.createElement("div", { ref: ref, style: style, "data-placement": placement, className: styles.suggestionsWrapper },
                    React.createElement(CustomScrollbar, { scrollTop: scrollTop, autoHeightMax: "300px", setScrollTop: ({ scrollTop }) => setScrollTop(scrollTop) },
                        React.createElement(DataLinkSuggestions, { activeRef: activeRef, suggestions: suggestions, onSuggestionSelect: onVariableSelect, onClose: () => setShowingSuggestions(false), activeIndex: suggestionsIndex }))));
            }))),
        invalid && error && (React.createElement("div", { className: styles.errorTooltip },
            React.createElement(FieldValidationMessage, null, error))),
        React.createElement(Input, { placeholder: placeholder, invalid: invalid, ref: inputRef, value: variableValue, onChange: onValueChanged, onBlur: onBlur, onKeyDown: onKeyDown })));
};
SuggestionsInput.displayName = 'SuggestionsInput';
function getElementPosition(suggestionElement, activeIndex) {
    var _a;
    return ((_a = suggestionElement === null || suggestionElement === void 0 ? void 0 : suggestionElement.clientHeight) !== null && _a !== void 0 ? _a : 0) * activeIndex;
}
//# sourceMappingURL=SuggestionsInput.js.map