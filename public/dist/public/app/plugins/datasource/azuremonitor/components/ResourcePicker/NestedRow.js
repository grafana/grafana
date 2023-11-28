import { __awaiter } from "tslib";
import { cx } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { FadeTransition, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { NestedEntry } from './NestedEntry';
import getStyles from './styles';
import { findRow } from './utils';
const NestedRow = ({ row, selectedRows, level, requestNestedRows, onRowSelectedChange, selectableEntryTypes, scrollIntoView, disableRow, }) => {
    var _a;
    const styles = useStyles2(getStyles);
    const [rowStatus, setRowStatus] = useState('closed');
    const isSelected = !!selectedRows.find((v) => v.uri.toLowerCase() === row.uri.toLowerCase());
    const isDisabled = !isSelected && disableRow(row, selectedRows);
    const isOpen = rowStatus === 'open';
    const onRowToggleCollapse = () => __awaiter(void 0, void 0, void 0, function* () {
        if (rowStatus === 'open') {
            setRowStatus('closed');
            return;
        }
        setRowStatus('loading');
        requestNestedRows(row)
            .then(() => setRowStatus('open'))
            .catch(() => setRowStatus('closed'));
    });
    // opens the resource group on load of component if there was a previously saved selection
    useEffect(() => {
        var _a;
        // Assuming we don't have multi-select yet
        const selectedRow = selectedRows[0];
        const containsChild = selectedRow && !!findRow((_a = row.children) !== null && _a !== void 0 ? _a : [], selectedRow.uri);
        if (containsChild) {
            setRowStatus('open');
        }
    }, [selectedRows, row]);
    return (React.createElement(React.Fragment, null,
        React.createElement("tr", { className: cx(styles.row, isDisabled && styles.disabledRow), key: row.id },
            React.createElement("td", { className: styles.cell },
                React.createElement(NestedEntry, { level: level, isSelected: isSelected, isDisabled: isDisabled, isOpen: isOpen, entry: row, onToggleCollapse: onRowToggleCollapse, onSelectedChange: onRowSelectedChange, isSelectable: selectableEntryTypes.some((type) => type === row.type), scrollIntoView: scrollIntoView })),
            React.createElement("td", { className: styles.cell }, row.typeLabel),
            React.createElement("td", { className: styles.cell }, (_a = row.location) !== null && _a !== void 0 ? _a : '-')),
        isOpen &&
            row.children &&
            Object.keys(row.children).length > 0 &&
            row.children.map((childRow) => (React.createElement(NestedRow, { key: childRow.uri, row: childRow, selectedRows: selectedRows, level: level + 1, requestNestedRows: requestNestedRows, onRowSelectedChange: onRowSelectedChange, selectableEntryTypes: selectableEntryTypes, scrollIntoView: scrollIntoView, disableRow: disableRow }))),
        React.createElement(FadeTransition, { visible: rowStatus === 'loading' },
            React.createElement("tr", null,
                React.createElement("td", { className: cx(styles.cell, styles.loadingCell), colSpan: 3 },
                    React.createElement(LoadingPlaceholder, { text: "Loading...", className: styles.spinner }))))));
};
export default NestedRow;
//# sourceMappingURL=NestedRow.js.map