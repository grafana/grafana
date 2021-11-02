import { __read } from "tslib";
import React, { useEffect, useMemo, useReducer } from 'react';
import { Button, Modal, useStyles } from '@grafana/ui';
import { LoadingState } from '@grafana/data';
import { asyncDispatcher } from '../LibraryPanelsView/actions';
import { deleteLibraryPanelModalReducer, initialDeleteLibraryPanelModalState } from './reducer';
import { getConnectedDashboards } from './actions';
import { getModalStyles } from '../../styles';
export var DeleteLibraryPanelModal = function (_a) {
    var libraryPanel = _a.libraryPanel, onDismiss = _a.onDismiss, onConfirm = _a.onConfirm;
    var styles = useStyles(getModalStyles);
    var _b = __read(useReducer(deleteLibraryPanelModalReducer, initialDeleteLibraryPanelModalState), 2), _c = _b[0], dashboardTitles = _c.dashboardTitles, loadingState = _c.loadingState, dispatch = _b[1];
    var asyncDispatch = useMemo(function () { return asyncDispatcher(dispatch); }, [dispatch]);
    useEffect(function () {
        asyncDispatch(getConnectedDashboards(libraryPanel));
    }, [asyncDispatch, libraryPanel]);
    var connected = Boolean(dashboardTitles.length);
    var done = loadingState === LoadingState.Done;
    return (React.createElement(Modal, { className: styles.modal, title: "Delete library panel", icon: "trash-alt", onDismiss: onDismiss, isOpen: true },
        !done ? React.createElement(LoadingIndicator, null) : null,
        done ? (React.createElement("div", null,
            connected ? React.createElement(HasConnectedDashboards, { dashboardTitles: dashboardTitles }) : null,
            !connected ? React.createElement(Confirm, null) : null,
            React.createElement(Modal.ButtonRow, null,
                React.createElement(Button, { variant: "secondary", onClick: onDismiss, fill: "outline" }, "Cancel"),
                React.createElement(Button, { variant: "destructive", onClick: onConfirm, disabled: connected }, "Delete")))) : null));
};
var LoadingIndicator = function () { return React.createElement("span", null, "Loading library panel..."); };
var Confirm = function () {
    var styles = useStyles(getModalStyles);
    return React.createElement("div", { className: styles.modalText }, "Do you want to delete this panel?");
};
var HasConnectedDashboards = function (_a) {
    var dashboardTitles = _a.dashboardTitles;
    var styles = useStyles(getModalStyles);
    var suffix = dashboardTitles.length === 1 ? 'dashboard.' : 'dashboards.';
    var message = dashboardTitles.length + " " + suffix;
    if (dashboardTitles.length === 0) {
        return null;
    }
    return (React.createElement("div", null,
        React.createElement("p", { className: styles.textInfo },
            'This library panel can not be deleted because it is connected to ',
            React.createElement("strong", null, message),
            ' Remove the library panel from the dashboards listed below and retry.'),
        React.createElement("table", { className: styles.myTable },
            React.createElement("thead", null,
                React.createElement("tr", null,
                    React.createElement("th", null, "Dashboard name"))),
            React.createElement("tbody", null, dashboardTitles.map(function (title, i) { return (React.createElement("tr", { key: "dash-title-" + i },
                React.createElement("td", null, title))); })))));
};
//# sourceMappingURL=DeleteLibraryPanelModal.js.map