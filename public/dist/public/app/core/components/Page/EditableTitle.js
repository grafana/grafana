import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';
import { isFetchError } from '@grafana/runtime';
import { Field, IconButton, Input, useStyles2, Text } from '@grafana/ui';
export const EditableTitle = ({ value, onEdit }) => {
    const styles = useStyles2(getStyles);
    const [localValue, setLocalValue] = useState(value);
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState();
    // sync local value with prop value
    useEffect(() => {
        setLocalValue(value);
    }, [value]);
    const onCommitChange = useCallback((event) => __awaiter(void 0, void 0, void 0, function* () {
        const newValue = event.currentTarget.value;
        if (!newValue) {
            setErrorMessage('Please enter a title');
        }
        else if (newValue === value) {
            // no need to bother saving if the value hasn't changed
            // just clear any previous error messages and exit edit mode
            setErrorMessage(undefined);
            setIsEditing(false);
        }
        else {
            setIsLoading(true);
            try {
                yield onEdit(newValue);
                setErrorMessage(undefined);
                setIsEditing(false);
            }
            catch (error) {
                if (isFetchError(error)) {
                    setErrorMessage(error.data.message);
                }
                else if (error instanceof Error) {
                    setErrorMessage(error.message);
                }
            }
            setIsLoading(false);
        }
    }), [onEdit, value]);
    return !isEditing ? (React.createElement("div", { className: styles.textContainer },
        React.createElement("div", { className: styles.textWrapper },
            React.createElement(Text, { element: "h1", truncate: true }, localValue),
            React.createElement(IconButton, { name: "pen", size: "lg", tooltip: "Edit title", onClick: () => setIsEditing(true) })))) : (React.createElement("div", { className: styles.inputContainer },
        React.createElement(Field, { className: styles.field, loading: isLoading, invalid: !!errorMessage, error: errorMessage },
            React.createElement(Input, { className: styles.input, defaultValue: localValue, onKeyDown: (event) => {
                    if (event.key === 'Enter') {
                        onCommitChange(event);
                    }
                }, 
                // perfectly reasonable to autofocus here since we've made a conscious choice by clicking the edit button
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus: true, onBlur: onCommitChange, onChange: (event) => setLocalValue(event.currentTarget.value), onFocus: () => setIsEditing(true) }))));
};
EditableTitle.displayName = 'EditableTitle';
const getStyles = (theme) => {
    return {
        textContainer: css({
            minWidth: 0,
        }),
        field: css({
            flex: 1,
            // magic number here to ensure the input text lines up exactly with the h1 text
            // input has a 1px border + theme.spacing(1) padding so we need to offset that
            left: `calc(-${theme.spacing(1)} - 1px)`,
            position: 'relative',
            marginBottom: 0,
        }),
        input: css({
            input: Object.assign({}, theme.typography.h1),
        }),
        inputContainer: css({
            display: 'flex',
            flex: 1,
        }),
        textWrapper: css({
            alignItems: 'center',
            display: 'flex',
            gap: theme.spacing(1),
        }),
    };
};
//# sourceMappingURL=EditableTitle.js.map