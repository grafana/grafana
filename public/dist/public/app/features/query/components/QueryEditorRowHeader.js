import { __assign, __makeTemplateObject, __read, __values } from "tslib";
import React, { useState } from 'react';
import { css, cx } from '@emotion/css';
import { DataSourcePicker } from '@grafana/runtime';
import { Icon, Input, FieldValidationMessage, useStyles } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
export var QueryEditorRowHeader = function (props) {
    var query = props.query, queries = props.queries, onClick = props.onClick, onChange = props.onChange, collapsedText = props.collapsedText, renderExtras = props.renderExtras, disabled = props.disabled;
    var styles = useStyles(getStyles);
    var _a = __read(useState(false), 2), isEditing = _a[0], setIsEditing = _a[1];
    var _b = __read(useState(null), 2), validationError = _b[0], setValidationError = _b[1];
    var onEditQuery = function (event) {
        setIsEditing(true);
    };
    var onEndEditName = function (newName) {
        setIsEditing(false);
        // Ignore change if invalid
        if (validationError) {
            setValidationError(null);
            return;
        }
        if (query.refId !== newName) {
            onChange(__assign(__assign({}, query), { refId: newName }));
        }
    };
    var onInputChange = function (event) {
        var e_1, _a;
        var newName = event.currentTarget.value.trim();
        if (newName.length === 0) {
            setValidationError('An empty query name is not allowed');
            return;
        }
        try {
            for (var queries_1 = __values(queries), queries_1_1 = queries_1.next(); !queries_1_1.done; queries_1_1 = queries_1.next()) {
                var otherQuery = queries_1_1.value;
                if (otherQuery !== query && newName === otherQuery.refId) {
                    setValidationError('Query name already exists');
                    return;
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (queries_1_1 && !queries_1_1.done && (_a = queries_1.return)) _a.call(queries_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        if (validationError) {
            setValidationError(null);
        }
    };
    var onEditQueryBlur = function (event) {
        onEndEditName(event.currentTarget.value.trim());
    };
    var onKeyDown = function (event) {
        if (event.key === 'Enter') {
            onEndEditName(event.target.value);
        }
    };
    var onFocus = function (event) {
        event.target.select();
    };
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: styles.wrapper },
            !isEditing && (React.createElement("button", { className: styles.queryNameWrapper, "aria-label": selectors.components.QueryEditorRow.title(query.refId), title: "Edit query name", onClick: onEditQuery, "data-testid": "query-name-div" },
                React.createElement("span", { className: styles.queryName }, query.refId),
                React.createElement(Icon, { name: "pen", className: styles.queryEditIcon, size: "sm" }))),
            isEditing && (React.createElement(React.Fragment, null,
                React.createElement(Input, { type: "text", defaultValue: query.refId, onBlur: onEditQueryBlur, autoFocus: true, onKeyDown: onKeyDown, onFocus: onFocus, invalid: validationError !== null, onChange: onInputChange, className: styles.queryNameInput, "data-testid": "query-name-input" }),
                validationError && React.createElement(FieldValidationMessage, { horizontal: true }, validationError))),
            renderDataSource(props, styles),
            renderExtras && React.createElement("div", { className: styles.itemWrapper }, renderExtras()),
            disabled && React.createElement("em", { className: styles.contextInfo }, "Disabled")),
        collapsedText && (React.createElement("div", { className: styles.collapsedText, onClick: onClick }, collapsedText))));
};
var renderDataSource = function (props, styles) {
    var dataSource = props.dataSource, onChangeDataSource = props.onChangeDataSource;
    if (!onChangeDataSource) {
        return React.createElement("em", { className: styles.contextInfo },
            "(",
            dataSource.name,
            ")");
    }
    return (React.createElement("div", { className: styles.itemWrapper },
        React.createElement(DataSourcePicker, { current: dataSource.name, onChange: onChangeDataSource })));
};
var getStyles = function (theme) {
    return {
        wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      label: Wrapper;\n      display: flex;\n      align-items: center;\n      margin-left: ", ";\n    "], ["\n      label: Wrapper;\n      display: flex;\n      align-items: center;\n      margin-left: ", ";\n    "])), theme.spacing.xs),
        queryNameWrapper: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      display: flex;\n      cursor: pointer;\n      border: 1px solid transparent;\n      border-radius: ", ";\n      align-items: center;\n      padding: 0 0 0 ", ";\n      margin: 0;\n      background: transparent;\n\n      &:hover {\n        background: ", ";\n        border: 1px dashed ", ";\n      }\n\n      &:focus {\n        border: 2px solid ", ";\n      }\n\n      &:hover,\n      &:focus {\n        .query-name-edit-icon {\n          visibility: visible;\n        }\n      }\n    "], ["\n      display: flex;\n      cursor: pointer;\n      border: 1px solid transparent;\n      border-radius: ", ";\n      align-items: center;\n      padding: 0 0 0 ", ";\n      margin: 0;\n      background: transparent;\n\n      &:hover {\n        background: ", ";\n        border: 1px dashed ", ";\n      }\n\n      &:focus {\n        border: 2px solid ", ";\n      }\n\n      &:hover,\n      &:focus {\n        .query-name-edit-icon {\n          visibility: visible;\n        }\n      }\n    "])), theme.border.radius.md, theme.spacing.xs, theme.colors.bg3, theme.colors.border3, theme.colors.formInputBorderActive),
        queryName: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      font-weight: ", ";\n      color: ", ";\n      cursor: pointer;\n      overflow: hidden;\n      margin-left: ", ";\n    "], ["\n      font-weight: ", ";\n      color: ", ";\n      cursor: pointer;\n      overflow: hidden;\n      margin-left: ", ";\n    "])), theme.typography.weight.semibold, theme.colors.textBlue, theme.spacing.xs),
        queryEditIcon: cx(css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n        margin-left: ", ";\n        visibility: hidden;\n      "], ["\n        margin-left: ", ";\n        visibility: hidden;\n      "])), theme.spacing.md), 'query-name-edit-icon'),
        queryNameInput: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      max-width: 300px;\n      margin: -4px 0;\n    "], ["\n      max-width: 300px;\n      margin: -4px 0;\n    "]))),
        collapsedText: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      font-weight: ", ";\n      font-size: ", ";\n      color: ", ";\n      padding-left: ", ";\n      align-items: center;\n      overflow: hidden;\n      font-style: italic;\n      white-space: nowrap;\n      text-overflow: ellipsis;\n    "], ["\n      font-weight: ", ";\n      font-size: ", ";\n      color: ", ";\n      padding-left: ", ";\n      align-items: center;\n      overflow: hidden;\n      font-style: italic;\n      white-space: nowrap;\n      text-overflow: ellipsis;\n    "])), theme.typography.weight.regular, theme.typography.size.sm, theme.colors.textWeak, theme.spacing.sm),
        contextInfo: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      font-size: ", ";\n      font-style: italic;\n      color: ", ";\n      padding-left: 10px;\n    "], ["\n      font-size: ", ";\n      font-style: italic;\n      color: ", ";\n      padding-left: 10px;\n    "])), theme.typography.size.sm, theme.colors.textWeak),
        itemWrapper: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n      display: flex;\n      margin-left: 4px;\n    "], ["\n      display: flex;\n      margin-left: 4px;\n    "]))),
    };
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8;
//# sourceMappingURL=QueryEditorRowHeader.js.map