import { css, cx } from '@emotion/css';
import React, { useEffect, useRef, useState } from 'react';
import { ConfirmButton, Input, Label, LegacyInputStatus, useStyles2 } from '@grafana/ui';
export const ServiceAccountProfileRow = ({ label, value, inputType, disabled, onChange }) => {
    const inputElem = useRef(null);
    const [inputValue, setInputValue] = useState(value);
    const [isEditing, setIsEditing] = useState(false);
    const styles = useStyles2(getStyles);
    const inputId = `${label}-input`;
    useEffect(() => {
        if (isEditing) {
            focusInput();
        }
    }, [isEditing]);
    const onEditClick = () => {
        setIsEditing(true);
    };
    const onCancelClick = () => {
        setIsEditing(false);
        setInputValue(value || '');
    };
    const onInputChange = (event, status) => {
        if (status === LegacyInputStatus.Invalid) {
            return;
        }
        setInputValue(event.target.value);
    };
    const onInputBlur = (event, status) => {
        if (status === LegacyInputStatus.Invalid) {
            return;
        }
        setInputValue(event.target.value);
    };
    const focusInput = () => {
        var _a;
        (_a = inputElem === null || inputElem === void 0 ? void 0 : inputElem.current) === null || _a === void 0 ? void 0 : _a.focus();
    };
    const onSave = () => {
        setIsEditing(false);
        if (onChange) {
            onChange(inputValue);
        }
    };
    return (React.createElement("tr", null,
        React.createElement("td", null,
            React.createElement(Label, { htmlFor: inputId }, label)),
        React.createElement("td", { className: "width-25", colSpan: 2 }, !disabled && isEditing ? (React.createElement(Input, { id: inputId, type: inputType, defaultValue: value, onBlur: onInputBlur, onChange: onInputChange, ref: inputElem, width: 30 })) : (React.createElement("span", { className: cx({ [styles.disabled]: disabled }) }, value))),
        React.createElement("td", null, onChange && (React.createElement(ConfirmButton, { closeOnConfirm: true, confirmText: "Save", onConfirm: onSave, onClick: onEditClick, onCancel: onCancelClick, disabled: disabled }, "Edit")))));
};
const getStyles = (theme) => {
    return {
        disabled: css `
      color: ${theme.colors.text.secondary};
    `,
    };
};
//# sourceMappingURL=ServiceAccountProfileRow.js.map