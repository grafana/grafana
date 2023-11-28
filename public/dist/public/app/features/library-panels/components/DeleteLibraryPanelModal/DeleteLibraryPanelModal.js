import React, { useEffect, useMemo, useReducer } from 'react';
import { LoadingState } from '@grafana/data';
import { Button, Modal, useStyles2 } from '@grafana/ui';
import { getModalStyles } from '../../styles';
import { asyncDispatcher } from '../LibraryPanelsView/actions';
import { getConnectedDashboards } from './actions';
import { deleteLibraryPanelModalReducer, initialDeleteLibraryPanelModalState } from './reducer';
export const DeleteLibraryPanelModal = ({ libraryPanel, onDismiss, onConfirm }) => {
    const styles = useStyles2(getModalStyles);
    const [{ dashboardTitles, loadingState }, dispatch] = useReducer(deleteLibraryPanelModalReducer, initialDeleteLibraryPanelModalState);
    const asyncDispatch = useMemo(() => asyncDispatcher(dispatch), [dispatch]);
    useEffect(() => {
        asyncDispatch(getConnectedDashboards(libraryPanel));
    }, [asyncDispatch, libraryPanel]);
    const connected = Boolean(dashboardTitles.length);
    const done = loadingState === LoadingState.Done;
    return (React.createElement(Modal, { className: styles.modal, title: "Delete library panel", icon: "trash-alt", onDismiss: onDismiss, isOpen: true },
        !done ? React.createElement(LoadingIndicator, null) : null,
        done ? (React.createElement("div", null,
            connected ? React.createElement(HasConnectedDashboards, { dashboardTitles: dashboardTitles }) : null,
            !connected ? React.createElement(Confirm, null) : null,
            React.createElement(Modal.ButtonRow, null,
                React.createElement(Button, { variant: "secondary", onClick: onDismiss, fill: "outline" }, "Cancel"),
                React.createElement(Button, { variant: "destructive", onClick: onConfirm, disabled: connected }, "Delete")))) : null));
};
const LoadingIndicator = () => React.createElement("span", null, "Loading library panel...");
const Confirm = () => {
    const styles = useStyles2(getModalStyles);
    return React.createElement("div", { className: styles.modalText }, "Do you want to delete this panel?");
};
const HasConnectedDashboards = ({ dashboardTitles }) => {
    const styles = useStyles2(getModalStyles);
    const suffix = dashboardTitles.length === 1 ? 'dashboard.' : 'dashboards.';
    const message = `${dashboardTitles.length} ${suffix}`;
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
            React.createElement("tbody", null, dashboardTitles.map((title, i) => (React.createElement("tr", { key: `dash-title-${i}` },
                React.createElement("td", null, title))))))));
};
//# sourceMappingURL=DeleteLibraryPanelModal.js.map