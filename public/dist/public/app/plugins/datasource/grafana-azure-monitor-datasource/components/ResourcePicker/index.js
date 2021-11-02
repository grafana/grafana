import { __assign, __awaiter, __generator, __read, __spreadArray } from "tslib";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import NestedResourceTable from './NestedResourceTable';
import { css } from '@emotion/css';
import { Button, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import ResourcePickerData from '../../resourcePicker/resourcePickerData';
import { Space } from '../Space';
import { addResources, findRow, parseResourceURI } from './utils';
var ResourcePicker = function (_a) {
    var resourcePickerData = _a.resourcePickerData, resourceURI = _a.resourceURI, templateVariables = _a.templateVariables, onApply = _a.onApply, onCancel = _a.onCancel;
    var styles = useStyles2(getStyles);
    var _b = __read(useState([]), 2), azureRows = _b[0], setAzureRows = _b[1];
    var _c = __read(useState(resourceURI), 2), internalSelected = _c[0], setInternalSelected = _c[1];
    var _d = __read(useState(false), 2), isLoading = _d[0], setIsLoading = _d[1];
    // Sync the resourceURI prop to internal state
    useEffect(function () {
        setInternalSelected(resourceURI);
    }, [resourceURI]);
    var rows = useMemo(function () {
        var templateVariableRow = resourcePickerData.transformVariablesToRow(templateVariables);
        return templateVariables.length ? __spreadArray(__spreadArray([], __read(azureRows), false), [templateVariableRow], false) : azureRows;
    }, [resourcePickerData, azureRows, templateVariables]);
    // Map the selected item into an array of rows
    var selectedResourceRows = useMemo(function () {
        var found = internalSelected && findRow(rows, internalSelected);
        return found
            ? [
                __assign(__assign({}, found), { children: undefined }),
            ]
            : [];
    }, [internalSelected, rows]);
    // Request resources for a expanded resource group
    var requestNestedRows = useCallback(function (resourceGroup) { return __awaiter(void 0, void 0, void 0, function () {
        var resources, newRows;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    // If we already have children, we don't need to re-fetch them. Also abort if we're expanding the special
                    // template variable group, though that shouldn't happen in practice
                    if (((_a = resourceGroup.children) === null || _a === void 0 ? void 0 : _a.length) || resourceGroup.id === ResourcePickerData.templateVariableGroupID) {
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, resourcePickerData.getResourcesForResourceGroup(resourceGroup)];
                case 1:
                    resources = _b.sent();
                    newRows = addResources(azureRows, resourceGroup.id, resources);
                    setAzureRows(newRows);
                    return [2 /*return*/];
            }
        });
    }); }, [resourcePickerData, azureRows]);
    // Select
    var handleSelectionChanged = useCallback(function (row, isSelected) {
        isSelected ? setInternalSelected(row.id) : setInternalSelected(undefined);
    }, []);
    // Request initial data on first mount
    useEffect(function () {
        setIsLoading(true);
        resourcePickerData.getResourcePickerData().then(function (initalRows) {
            setIsLoading(false);
            setAzureRows(initalRows);
        });
    }, [resourcePickerData]);
    // Request sibling resources for a selected resource - in practice should only be on first mount
    useEffect(function () {
        if (!internalSelected || !rows.length) {
            return;
        }
        // If we can find this resource in the rows, then we don't need to load anything
        var foundResourceRow = findRow(rows, internalSelected);
        if (foundResourceRow) {
            return;
        }
        var parsedURI = parseResourceURI(internalSelected);
        var resourceGroupURI = "/subscriptions/" + (parsedURI === null || parsedURI === void 0 ? void 0 : parsedURI.subscriptionID) + "/resourceGroups/" + (parsedURI === null || parsedURI === void 0 ? void 0 : parsedURI.resourceGroup);
        var resourceGroupRow = findRow(rows, resourceGroupURI);
        if (!resourceGroupRow) {
            // We haven't loaded the data from Azure yet
            return;
        }
        requestNestedRows(resourceGroupRow);
    }, [requestNestedRows, internalSelected, rows]);
    var handleApply = useCallback(function () {
        onApply(internalSelected);
    }, [internalSelected, onApply]);
    return (React.createElement("div", null, isLoading ? (React.createElement("div", { className: styles.loadingWrapper },
        React.createElement(LoadingPlaceholder, { text: 'Loading resources...' }))) : (React.createElement(React.Fragment, null,
        React.createElement(NestedResourceTable, { rows: rows, requestNestedRows: requestNestedRows, onRowSelectedChange: handleSelectionChanged, selectedRows: selectedResourceRows }),
        React.createElement("div", { className: styles.selectionFooter },
            selectedResourceRows.length > 0 && (React.createElement(React.Fragment, null,
                React.createElement(Space, { v: 2 }),
                React.createElement("h5", null, "Selection"),
                React.createElement(NestedResourceTable, { rows: selectedResourceRows, requestNestedRows: requestNestedRows, onRowSelectedChange: handleSelectionChanged, selectedRows: selectedResourceRows, noHeader: true }))),
            React.createElement(Space, { v: 2 }),
            React.createElement(Button, { onClick: handleApply }, "Apply"),
            React.createElement(Space, { layout: "inline", h: 1 }),
            React.createElement(Button, { onClick: onCancel, variant: "secondary" }, "Cancel"))))));
};
export default ResourcePicker;
var getStyles = function (theme) { return ({
    selectionFooter: css({
        position: 'sticky',
        bottom: 0,
        background: theme.colors.background.primary,
        paddingTop: theme.spacing(2),
    }),
    loadingWrapper: css({
        textAlign: 'center',
        paddingTop: theme.spacing(2),
        paddingBottom: theme.spacing(2),
        color: theme.colors.text.secondary,
    }),
}); };
//# sourceMappingURL=index.js.map