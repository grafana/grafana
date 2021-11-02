import { __awaiter, __generator, __read } from "tslib";
import React, { useCallback, useState } from 'react';
import { Button, Icon, Input, Modal, useStyles } from '@grafana/ui';
import { useAsync, useDebounce } from 'react-use';
import { usePanelSave } from '../../utils/usePanelSave';
import { getConnectedDashboards } from '../../state/api';
import { getModalStyles } from '../../styles';
export var SaveLibraryPanelModal = function (_a) {
    var panel = _a.panel, folderId = _a.folderId, isUnsavedPrompt = _a.isUnsavedPrompt, onDismiss = _a.onDismiss, onConfirm = _a.onConfirm, onDiscard = _a.onDiscard;
    var _b = __read(useState(''), 2), searchString = _b[0], setSearchString = _b[1];
    var dashState = useAsync(function () { return __awaiter(void 0, void 0, void 0, function () {
        var searchHits;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getConnectedDashboards(panel.libraryPanel.uid)];
                case 1:
                    searchHits = _a.sent();
                    if (searchHits.length > 0) {
                        return [2 /*return*/, searchHits.map(function (dash) { return dash.title; })];
                    }
                    return [2 /*return*/, []];
            }
        });
    }); }, [panel.libraryPanel.uid]);
    var _c = __read(useState([]), 2), filteredDashboards = _c[0], setFilteredDashboards = _c[1];
    useDebounce(function () {
        if (!dashState.value) {
            return setFilteredDashboards([]);
        }
        return setFilteredDashboards(dashState.value.filter(function (dashName) { return dashName.toLowerCase().includes(searchString.toLowerCase()); }));
    }, 300, [dashState.value, searchString]);
    var saveLibraryPanel = usePanelSave().saveLibraryPanel;
    var styles = useStyles(getModalStyles);
    var discardAndClose = useCallback(function () {
        onDiscard();
    }, [onDiscard]);
    var title = isUnsavedPrompt ? 'Unsaved library panel changes' : 'Save library panel';
    return (React.createElement(Modal, { title: title, icon: "save", onDismiss: onDismiss, isOpen: true },
        React.createElement("div", null,
            React.createElement("p", { className: styles.textInfo },
                'This update will affect ',
                React.createElement("strong", null,
                    panel.libraryPanel.meta.connectedDashboards,
                    ' ',
                    panel.libraryPanel.meta.connectedDashboards === 1 ? 'dashboard' : 'dashboards',
                    "."),
                "The following dashboards using the panel will be affected:"),
            React.createElement(Input, { className: styles.dashboardSearch, prefix: React.createElement(Icon, { name: "search" }), placeholder: "Search affected dashboards", value: searchString, onChange: function (e) { return setSearchString(e.currentTarget.value); } }),
            dashState.loading ? (React.createElement("p", null, "Loading connected dashboards...")) : (React.createElement("table", { className: styles.myTable },
                React.createElement("thead", null,
                    React.createElement("tr", null,
                        React.createElement("th", null, "Dashboard name"))),
                React.createElement("tbody", null, filteredDashboards.map(function (dashName, i) { return (React.createElement("tr", { key: "dashrow-" + i },
                    React.createElement("td", null, dashName))); })))),
            React.createElement(Modal.ButtonRow, null,
                React.createElement(Button, { variant: "secondary", onClick: onDismiss, fill: "outline" }, "Cancel"),
                isUnsavedPrompt && (React.createElement(Button, { variant: "destructive", onClick: discardAndClose }, "Discard")),
                React.createElement(Button, { onClick: function () {
                        saveLibraryPanel(panel, folderId).then(function () {
                            onConfirm();
                        });
                    } }, "Update all")))));
};
//# sourceMappingURL=SaveLibraryPanelModal.js.map