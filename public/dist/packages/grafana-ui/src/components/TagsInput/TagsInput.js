import { __makeTemplateObject, __read } from "tslib";
import React, { useState } from 'react';
import { css, cx } from '@emotion/css';
import { Button } from '../Button';
import { TagItem } from './TagItem';
import { useStyles, useTheme2 } from '../../themes/ThemeContext';
import { Input } from '../Input/Input';
export var TagsInput = function (_a) {
    var _b = _a.placeholder, placeholder = _b === void 0 ? 'New tag (enter key to add)' : _b, _c = _a.tags, tags = _c === void 0 ? [] : _c, onChange = _a.onChange, width = _a.width, className = _a.className, disabled = _a.disabled, addOnBlur = _a.addOnBlur, invalid = _a.invalid;
    var _d = __read(useState(''), 2), newTagName = _d[0], setNewName = _d[1];
    var styles = useStyles(getStyles);
    var theme = useTheme2();
    var onNameChange = function (event) {
        setNewName(event.target.value);
    };
    var onRemove = function (tagToRemove) {
        if (disabled) {
            return;
        }
        onChange(tags === null || tags === void 0 ? void 0 : tags.filter(function (x) { return x !== tagToRemove; }));
    };
    var onAdd = function (event) {
        event === null || event === void 0 ? void 0 : event.preventDefault();
        if (!tags.includes(newTagName)) {
            onChange(tags.concat(newTagName));
        }
        setNewName('');
    };
    var onBlur = function () {
        if (addOnBlur && newTagName) {
            onAdd();
        }
    };
    var onKeyboardAdd = function (event) {
        event.preventDefault();
        if (event.key === 'Enter' && newTagName !== '') {
            onChange(tags.concat(newTagName));
            setNewName('');
        }
    };
    return (React.createElement("div", { className: cx(styles.wrapper, className, width ? css({ width: theme.spacing(width) }) : '') },
        React.createElement("div", { className: (tags === null || tags === void 0 ? void 0 : tags.length) ? styles.tags : undefined }, tags === null || tags === void 0 ? void 0 : tags.map(function (tag, index) {
            return React.createElement(TagItem, { key: tag + "-" + index, name: tag, onRemove: onRemove });
        })),
        React.createElement("div", null,
            React.createElement(Input, { disabled: disabled, placeholder: placeholder, onChange: onNameChange, value: newTagName, onKeyUp: onKeyboardAdd, onBlur: onBlur, invalid: invalid, suffix: newTagName.length > 0 && (React.createElement(Button, { fill: "text", className: styles.addButtonStyle, onClick: onAdd, size: "md" }, "Add")) }))));
};
var getStyles = function (theme) { return ({
    wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    min-height: ", "px;\n    align-items: center;\n    display: flex;\n    flex-wrap: wrap;\n  "], ["\n    min-height: ", "px;\n    align-items: center;\n    display: flex;\n    flex-wrap: wrap;\n  "])), theme.spacing.formInputHeight),
    tags: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    display: flex;\n    justify-content: flex-start;\n    flex-wrap: wrap;\n    margin-right: ", ";\n  "], ["\n    display: flex;\n    justify-content: flex-start;\n    flex-wrap: wrap;\n    margin-right: ", ";\n  "])), theme.spacing.xs),
    addButtonStyle: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    margin: 0 -", ";\n  "], ["\n    margin: 0 -", ";\n  "])), theme.spacing.sm),
}); };
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=TagsInput.js.map