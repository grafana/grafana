import { css, cx } from '@emotion/css';
import React, { useState } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { Icon, Input, FieldValidationMessage, useStyles2 } from '@grafana/ui';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
export const QueryEditorRowHeader = (props) => {
    const { query, queries, onChange, collapsedText, renderExtras, disabled } = props;
    const styles = useStyles2(getStyles);
    const [isEditing, setIsEditing] = useState(false);
    const [validationError, setValidationError] = useState(null);
    const onEditQuery = (event) => {
        setIsEditing(true);
    };
    const onEndEditName = (newName) => {
        setIsEditing(false);
        // Ignore change if invalid
        if (validationError) {
            setValidationError(null);
            return;
        }
        if (query.refId !== newName) {
            onChange(Object.assign(Object.assign({}, query), { refId: newName }));
        }
    };
    const onInputChange = (event) => {
        const newName = event.currentTarget.value.trim();
        if (newName.length === 0) {
            setValidationError('An empty query name is not allowed');
            return;
        }
        for (const otherQuery of queries) {
            if (otherQuery !== query && newName === otherQuery.refId) {
                setValidationError('Query name already exists');
                return;
            }
        }
        if (validationError) {
            setValidationError(null);
        }
    };
    const onEditQueryBlur = (event) => {
        onEndEditName(event.currentTarget.value.trim());
    };
    const onKeyDown = (event) => {
        if (event.key === 'Enter') {
            onEndEditName(event.currentTarget.value);
        }
    };
    const onFocus = (event) => {
        event.target.select();
    };
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: styles.wrapper },
            !isEditing && (React.createElement("button", { className: styles.queryNameWrapper, "aria-label": selectors.components.QueryEditorRow.title(query.refId), title: "Edit query name", onClick: onEditQuery, "data-testid": "query-name-div", type: "button" },
                React.createElement("span", { className: styles.queryName }, query.refId),
                React.createElement(Icon, { name: "pen", className: styles.queryEditIcon, size: "sm" }))),
            isEditing && (React.createElement(React.Fragment, null,
                React.createElement(Input, { type: "text", defaultValue: query.refId, onBlur: onEditQueryBlur, autoFocus: true, onKeyDown: onKeyDown, onFocus: onFocus, invalid: validationError !== null, onChange: onInputChange, className: styles.queryNameInput, "data-testid": "query-name-input" }),
                validationError && React.createElement(FieldValidationMessage, { horizontal: true }, validationError))),
            renderDataSource(props, styles),
            renderExtras && React.createElement("div", { className: styles.itemWrapper }, renderExtras()),
            disabled && React.createElement("em", { className: styles.contextInfo }, "Disabled")),
        collapsedText && React.createElement("div", { className: styles.collapsedText }, collapsedText)));
};
const renderDataSource = (props, styles) => {
    const { alerting, dataSource, onChangeDataSource } = props;
    if (!onChangeDataSource) {
        return React.createElement("em", { className: styles.contextInfo },
            "(",
            dataSource.name,
            ")");
    }
    return (React.createElement("div", { className: styles.itemWrapper },
        React.createElement(DataSourcePicker, { variables: true, alerting: alerting, current: dataSource.name, onChange: onChangeDataSource })));
};
const getStyles = (theme) => {
    return {
        wrapper: css `
      label: Wrapper;
      display: flex;
      align-items: center;
      margin-left: ${theme.spacing(0.5)};
      overflow: hidden;
    `,
        queryNameWrapper: css `
      display: flex;
      cursor: pointer;
      border: 1px solid transparent;
      border-radius: ${theme.shape.borderRadius(2)};
      align-items: center;
      padding: 0 0 0 ${theme.spacing(0.5)};
      margin: 0;
      background: transparent;
      overflow: hidden;

      &:hover {
        background: ${theme.colors.action.hover};
        border: 1px dashed ${theme.colors.border.strong};
      }

      &:focus {
        border: 2px solid ${theme.colors.primary.border};
      }

      &:hover,
      &:focus {
        .query-name-edit-icon {
          visibility: visible;
        }
      }
    `,
        queryName: css `
      font-weight: ${theme.typography.fontWeightMedium};
      color: ${theme.colors.primary.text};
      cursor: pointer;
      overflow: hidden;
      margin-left: ${theme.spacing(0.5)};
    `,
        queryEditIcon: cx(css `
        margin-left: ${theme.spacing(2)};
        visibility: hidden;
      `, 'query-name-edit-icon'),
        queryNameInput: css `
      max-width: 300px;
      margin: -4px 0;
    `,
        collapsedText: css `
      font-weight: ${theme.typography.fontWeightRegular};
      font-size: ${theme.typography.bodySmall.fontSize};
      color: ${theme.colors.text.secondary};
      padding-left: ${theme.spacing(1)};
      align-items: center;
      overflow: hidden;
      font-style: italic;
      white-space: nowrap;
      text-overflow: ellipsis;
    `,
        contextInfo: css `
      font-size: ${theme.typography.bodySmall.fontSize};
      font-style: italic;
      color: ${theme.colors.text.secondary};
      padding-left: 10px;
      padding-right: 10px;
    `,
        itemWrapper: css `
      display: flex;
      margin-left: 4px;
    `,
    };
};
//# sourceMappingURL=QueryEditorRowHeader.js.map