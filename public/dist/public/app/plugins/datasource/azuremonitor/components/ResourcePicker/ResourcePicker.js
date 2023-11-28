import { __awaiter } from "tslib";
import { cx } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';
import { useEffectOnce } from 'react-use';
import { Alert, Button, LoadingPlaceholder, Modal, useStyles2 } from '@grafana/ui';
import { selectors } from '../../e2e/selectors';
import messageFromError from '../../utils/messageFromError';
import { Space } from '../Space';
import AdvancedMulti from './AdvancedMulti';
import NestedRow from './NestedRow';
import Search from './Search';
import getStyles from './styles';
import { findRows, parseMultipleResourceDetails, resourcesToStrings, matchURI, resourceToString } from './utils';
const ResourcePicker = ({ resourcePickerData, resources, onApply, onCancel, selectableEntryTypes, queryType, disableRow, renderAdvanced, selectionNotice, }) => {
    const styles = useStyles2(getStyles);
    const [isLoading, setIsLoading] = useState(false);
    const [rows, setRows] = useState([]);
    const [selectedRows, setSelectedRows] = useState([]);
    const [internalSelected, setInternalSelected] = useState(resources);
    const [errorMessage, setErrorMessage] = useState(undefined);
    const [shouldShowLimitFlag, setShouldShowLimitFlag] = useState(false);
    const selectionNoticeText = selectionNotice === null || selectionNotice === void 0 ? void 0 : selectionNotice(selectedRows);
    // Sync the resourceURI prop to internal state
    useEffect(() => {
        setInternalSelected(resources);
    }, [resources]);
    const loadInitialData = useCallback(() => __awaiter(void 0, void 0, void 0, function* () {
        if (!isLoading) {
            try {
                setIsLoading(true);
                const resources = yield resourcePickerData.fetchInitialRows(queryType, parseMultipleResourceDetails(internalSelected !== null && internalSelected !== void 0 ? internalSelected : {}));
                setRows(resources);
            }
            catch (error) {
                setErrorMessage(messageFromError(error));
            }
            setIsLoading(false);
        }
    }), [internalSelected, isLoading, resourcePickerData, queryType]);
    useEffectOnce(() => {
        loadInitialData();
    });
    // Avoid using empty resources
    const isValid = (r) => typeof r === 'string' ? r !== '' : r.subscription && r.resourceGroup && r.resourceName && r.metricNamespace;
    // set selected row data whenever row or selection changes
    useEffect(() => {
        if (!internalSelected) {
            setSelectedRows([]);
        }
        const sanitized = internalSelected.filter((r) => isValid(r));
        const found = internalSelected && findRows(rows, resourcesToStrings(sanitized));
        if ((sanitized === null || sanitized === void 0 ? void 0 : sanitized.length) > found.length) {
            // Not all the selected items are in the current rows, so we need to generate the row
            // information for those.
            return setSelectedRows(resourcePickerData.parseRows(sanitized));
        }
        if (found && found.length) {
            return setSelectedRows(found);
        }
        return setSelectedRows([]);
    }, [internalSelected, rows, resourcePickerData]);
    // Request resources for an expanded resource group
    const requestNestedRows = useCallback((parentRow) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        // clear error message (also when loading cached resources)
        setErrorMessage(undefined);
        // If we already have children, we don't need to re-fetch them.
        if ((_a = parentRow.children) === null || _a === void 0 ? void 0 : _a.length) {
            return;
        }
        try {
            const nestedRows = yield resourcePickerData.fetchAndAppendNestedRow(rows, parentRow, queryType);
            setRows(nestedRows);
        }
        catch (error) {
            setErrorMessage(messageFromError(error));
            throw error;
        }
    }), [resourcePickerData, rows, queryType]);
    const handleSelectionChanged = useCallback((row, isSelected) => {
        if (isSelected) {
            const newRes = queryType === 'logs' ? row.uri : parseMultipleResourceDetails([row.uri], row.location)[0];
            const newSelected = internalSelected ? internalSelected.concat(newRes) : [newRes];
            setInternalSelected(newSelected.filter((r) => isValid(r)));
        }
        else {
            const newInternalSelected = internalSelected === null || internalSelected === void 0 ? void 0 : internalSelected.filter((r) => {
                return !matchURI(resourceToString(r), row.uri);
            });
            setInternalSelected(newInternalSelected);
        }
    }, [queryType, internalSelected, setInternalSelected]);
    const handleApply = useCallback(() => {
        if (internalSelected) {
            onApply(queryType === 'logs' ? internalSelected : parseMultipleResourceDetails(internalSelected));
        }
    }, [queryType, internalSelected, onApply]);
    const handleSearch = useCallback((searchWord) => __awaiter(void 0, void 0, void 0, function* () {
        // clear errors and warnings
        setErrorMessage(undefined);
        setShouldShowLimitFlag(false);
        if (!searchWord) {
            loadInitialData();
            return;
        }
        try {
            setIsLoading(true);
            const searchResults = yield resourcePickerData.search(searchWord, queryType);
            setRows(searchResults);
            if (searchResults.length >= resourcePickerData.resultLimit) {
                setShouldShowLimitFlag(true);
            }
        }
        catch (err) {
            setErrorMessage(messageFromError(err));
        }
        setIsLoading(false);
    }), [loadInitialData, resourcePickerData, queryType]);
    return (React.createElement(React.Fragment, null,
        React.createElement(Search, { searchFn: handleSearch }),
        shouldShowLimitFlag ? (React.createElement("p", { className: styles.resultLimit },
            "Showing first ",
            resourcePickerData.resultLimit,
            " results")) : (React.createElement(Space, { v: 2 })),
        React.createElement("table", { className: styles.table },
            React.createElement("thead", null,
                React.createElement("tr", { className: cx(styles.row, styles.header) },
                    React.createElement("td", { className: styles.cell }, "Scope"),
                    React.createElement("td", { className: styles.cell }, "Type"),
                    React.createElement("td", { className: styles.cell }, "Location")))),
        React.createElement("div", { className: cx(styles.scrollableTable, styles.tableScroller) },
            React.createElement("table", { className: styles.table },
                React.createElement("tbody", null,
                    isLoading && (React.createElement("tr", { className: cx(styles.row) },
                        React.createElement("td", { className: styles.cell },
                            React.createElement(LoadingPlaceholder, { text: 'Loading...' })))),
                    !isLoading && rows.length === 0 && (React.createElement("tr", { className: cx(styles.row) },
                        React.createElement("td", { className: styles.cell, "aria-live": "polite" }, "No resources found"))),
                    !isLoading &&
                        rows.map((row) => (React.createElement(NestedRow, { key: row.uri, row: row, selectedRows: selectedRows, level: 0, requestNestedRows: requestNestedRows, onRowSelectedChange: handleSelectionChanged, selectableEntryTypes: selectableEntryTypes, scrollIntoView: true, disableRow: disableRow })))))),
        React.createElement("footer", { className: styles.selectionFooter },
            selectedRows.length > 0 && (React.createElement(React.Fragment, null,
                React.createElement("h5", null, "Selection"),
                React.createElement("div", { className: cx(styles.scrollableTable, styles.selectedTableScroller) },
                    React.createElement("table", { className: styles.table },
                        React.createElement("tbody", null, selectedRows.map((row) => (React.createElement(NestedRow, { key: row.uri, row: row, selectedRows: selectedRows, level: 0, requestNestedRows: requestNestedRows, onRowSelectedChange: handleSelectionChanged, selectableEntryTypes: selectableEntryTypes, disableRow: () => false })))))),
                React.createElement(Space, { v: 2 }),
                (selectionNoticeText === null || selectionNoticeText === void 0 ? void 0 : selectionNoticeText.length) ? (React.createElement(Alert, { title: "", severity: "info" }, selectionNoticeText)) : null)),
            React.createElement(AdvancedMulti, { resources: internalSelected, onChange: (r) => setInternalSelected(r), renderAdvanced: renderAdvanced }),
            errorMessage && (React.createElement(React.Fragment, null,
                React.createElement(Space, { v: 2 }),
                React.createElement(Alert, { severity: "error", title: "An error occurred while requesting resources from Azure Monitor" }, errorMessage))),
            React.createElement(Modal.ButtonRow, null,
                React.createElement(Button, { onClick: onCancel, variant: "secondary", fill: "outline" }, "Cancel"),
                React.createElement(Button, { disabled: !!errorMessage || !internalSelected.every(isValid), onClick: handleApply, "data-testid": selectors.components.queryEditor.resourcePicker.apply.button }, "Apply")))));
};
export default ResourcePicker;
//# sourceMappingURL=ResourcePicker.js.map