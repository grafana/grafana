import { __awaiter, __generator, __read } from "tslib";
import { cx } from '@emotion/css';
import { Checkbox, Icon, IconButton, LoadingPlaceholder, useStyles2, useTheme2, FadeTransition } from '@grafana/ui';
import React, { useCallback, useEffect, useState } from 'react';
import { Space } from '../Space';
import getStyles from './styles';
import { ResourceRowType } from './types';
import { findRow } from './utils';
var NestedRows = function (_a) {
    var rows = _a.rows, selectedRows = _a.selectedRows, level = _a.level, requestNestedRows = _a.requestNestedRows, onRowSelectedChange = _a.onRowSelectedChange;
    return (React.createElement(React.Fragment, null, rows.map(function (row) { return (React.createElement(NestedRow, { key: row.id, row: row, selectedRows: selectedRows, level: level, requestNestedRows: requestNestedRows, onRowSelectedChange: onRowSelectedChange })); })));
};
var NestedRow = function (_a) {
    var _b;
    var row = _a.row, selectedRows = _a.selectedRows, level = _a.level, requestNestedRows = _a.requestNestedRows, onRowSelectedChange = _a.onRowSelectedChange;
    var styles = useStyles2(getStyles);
    var initialOpenStatus = row.type === ResourceRowType.Subscription ? 'open' : 'closed';
    var _c = __read(useState(initialOpenStatus), 2), rowStatus = _c[0], setRowStatus = _c[1];
    var isSelected = !!selectedRows.find(function (v) { return v.id === row.id; });
    var isDisabled = selectedRows.length > 0 && !isSelected;
    var isOpen = rowStatus === 'open';
    var onRowToggleCollapse = function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (rowStatus === 'open') {
                        setRowStatus('closed');
                        return [2 /*return*/];
                    }
                    setRowStatus('loading');
                    return [4 /*yield*/, requestNestedRows(row)];
                case 1:
                    _a.sent();
                    setRowStatus('open');
                    return [2 /*return*/];
            }
        });
    }); };
    // opens the resource group on load of component if there was a previously saved selection
    useEffect(function () {
        var _a;
        // Assuming we don't have multi-select yet
        var selectedRow = selectedRows[0];
        var containsChild = selectedRow && !!findRow((_a = row.children) !== null && _a !== void 0 ? _a : [], selectedRow.id);
        if (containsChild) {
            setRowStatus('open');
        }
    }, [selectedRows, row]);
    return (React.createElement(React.Fragment, null,
        React.createElement("tr", { className: cx(styles.row, isDisabled && styles.disabledRow), key: row.id },
            React.createElement("td", { className: styles.cell },
                React.createElement(NestedEntry, { level: level, isSelected: isSelected, isDisabled: isDisabled, isOpen: isOpen, entry: row, onToggleCollapse: onRowToggleCollapse, onSelectedChange: onRowSelectedChange })),
            React.createElement("td", { className: styles.cell }, row.typeLabel),
            React.createElement("td", { className: styles.cell }, (_b = row.location) !== null && _b !== void 0 ? _b : '-')),
        isOpen && row.children && Object.keys(row.children).length > 0 && (React.createElement(NestedRows, { rows: row.children, selectedRows: selectedRows, level: level + 1, requestNestedRows: requestNestedRows, onRowSelectedChange: onRowSelectedChange })),
        React.createElement(FadeTransition, { visible: rowStatus === 'loading' },
            React.createElement("tr", null,
                React.createElement("td", { className: cx(styles.cell, styles.loadingCell), colSpan: 3 },
                    React.createElement(LoadingPlaceholder, { text: "Loading...", className: styles.spinner }))))));
};
var EntryIcon = function (_a) {
    var isOpen = _a.isOpen, type = _a.entry.type;
    switch (type) {
        case ResourceRowType.Subscription:
            return React.createElement(Icon, { name: "layer-group" });
        case ResourceRowType.ResourceGroup:
            return React.createElement(Icon, { name: isOpen ? 'folder-open' : 'folder' });
        case ResourceRowType.Resource:
            return React.createElement(Icon, { name: "cube" });
        case ResourceRowType.VariableGroup:
            return React.createElement(Icon, { name: "x" });
        case ResourceRowType.Variable:
            return React.createElement(Icon, { name: "x" });
        default:
            return null;
    }
};
var NestedEntry = function (_a) {
    var entry = _a.entry, isSelected = _a.isSelected, isDisabled = _a.isDisabled, isOpen = _a.isOpen, level = _a.level, onToggleCollapse = _a.onToggleCollapse, onSelectedChange = _a.onSelectedChange;
    var theme = useTheme2();
    var styles = useStyles2(getStyles);
    var hasChildren = !!entry.children;
    // Subscriptions, resource groups, resources, and variables are all selectable, so
    // the top-level variable group is the only thing that cannot be selected.
    var isSelectable = entry.type !== ResourceRowType.VariableGroup;
    var handleToggleCollapse = useCallback(function () {
        onToggleCollapse(entry);
    }, [onToggleCollapse, entry]);
    var handleSelectedChanged = useCallback(function (ev) {
        var isSelected = ev.target.checked;
        onSelectedChange(entry, isSelected);
    }, [entry, onSelectedChange]);
    var checkboxId = "checkbox_" + entry.id;
    return (React.createElement("div", { className: styles.nestedEntry, style: { marginLeft: level * (3 * theme.spacing.gridSize) } },
        hasChildren ? (React.createElement(IconButton, { className: styles.collapseButton, name: isOpen ? 'angle-down' : 'angle-right', "aria-label": isOpen ? 'Collapse' : 'Expand', onClick: handleToggleCollapse, id: entry.id })) : (React.createElement(Space, { layout: "inline", h: 2 })),
        React.createElement(Space, { layout: "inline", h: 2 }),
        isSelectable && (React.createElement(React.Fragment, null,
            React.createElement(Checkbox, { id: checkboxId, onChange: handleSelectedChanged, disabled: isDisabled, value: isSelected }),
            React.createElement(Space, { layout: "inline", h: 2 }))),
        React.createElement(EntryIcon, { entry: entry, isOpen: isOpen }),
        React.createElement(Space, { layout: "inline", h: 1 }),
        React.createElement("label", { htmlFor: checkboxId, className: cx(styles.entryContentItem, styles.truncated) }, entry.name)));
};
export default NestedRows;
//# sourceMappingURL=NestedRows.js.map