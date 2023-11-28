import { groupBy } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import { Stack } from '@grafana/experimental';
import { Button, Icon, Modal, Spinner } from '@grafana/ui';
import { AlertState, } from 'app/plugins/datasource/alertmanager/types';
import { AlertGroup } from '../alert-groups/AlertGroup';
import { useGetAmRouteReceiverWithGrafanaAppTypes } from '../receivers/grafanaAppReceivers/grafanaApp';
import { AlertGroupsSummary } from './AlertGroupsSummary';
import { AmRootRouteForm } from './EditDefaultPolicyForm';
import { AmRoutesExpandedForm } from './EditNotificationPolicyForm';
import { Matchers } from './Matchers';
const useAddPolicyModal = (receivers = [], handleAdd, loading) => {
    const [showModal, setShowModal] = useState(false);
    const [parentRoute, setParentRoute] = useState();
    const AmRouteReceivers = useGetAmRouteReceiverWithGrafanaAppTypes(receivers);
    const handleDismiss = useCallback(() => {
        setParentRoute(undefined);
        setShowModal(false);
    }, []);
    const handleShow = useCallback((parentRoute) => {
        setParentRoute(parentRoute);
        setShowModal(true);
    }, []);
    const modalElement = useMemo(() => loading ? (React.createElement(UpdatingModal, { isOpen: showModal })) : (React.createElement(Modal, { isOpen: showModal, onDismiss: handleDismiss, closeOnBackdropClick: true, closeOnEscape: true, title: "Add notification policy" },
        React.createElement(AmRoutesExpandedForm, { receivers: AmRouteReceivers, defaults: {
                groupBy: parentRoute === null || parentRoute === void 0 ? void 0 : parentRoute.group_by,
            }, onSubmit: (newRoute) => parentRoute && handleAdd(newRoute, parentRoute), actionButtons: React.createElement(Modal.ButtonRow, null,
                React.createElement(Button, { type: "button", variant: "secondary", onClick: handleDismiss, fill: "outline" }, "Cancel"),
                React.createElement(Button, { type: "submit" }, "Save policy")) }))), [AmRouteReceivers, handleAdd, handleDismiss, loading, parentRoute, showModal]);
    return [modalElement, handleShow, handleDismiss];
};
const useEditPolicyModal = (alertManagerSourceName, receivers, handleSave, loading) => {
    const [showModal, setShowModal] = useState(false);
    const [isDefaultPolicy, setIsDefaultPolicy] = useState(false);
    const [route, setRoute] = useState();
    const AmRouteReceivers = useGetAmRouteReceiverWithGrafanaAppTypes(receivers);
    const handleDismiss = useCallback(() => {
        setRoute(undefined);
        setShowModal(false);
    }, []);
    const handleShow = useCallback((route, isDefaultPolicy) => {
        setIsDefaultPolicy(isDefaultPolicy !== null && isDefaultPolicy !== void 0 ? isDefaultPolicy : false);
        setRoute(route);
        setShowModal(true);
    }, []);
    const modalElement = useMemo(() => loading ? (React.createElement(UpdatingModal, { isOpen: showModal })) : (React.createElement(Modal, { isOpen: showModal, onDismiss: handleDismiss, closeOnBackdropClick: true, closeOnEscape: true, title: "Edit notification policy" },
        isDefaultPolicy && route && (React.createElement(AmRootRouteForm
        // TODO *sigh* this alertmanagersourcename should come from context or something
        // passing it down all the way here is a code smell
        , { 
            // TODO *sigh* this alertmanagersourcename should come from context or something
            // passing it down all the way here is a code smell
            alertManagerSourceName: alertManagerSourceName, onSubmit: handleSave, receivers: AmRouteReceivers, route: route, actionButtons: React.createElement(Modal.ButtonRow, null,
                React.createElement(Button, { type: "button", variant: "secondary", onClick: handleDismiss, fill: "outline" }, "Cancel"),
                React.createElement(Button, { type: "submit" }, "Update default policy")) })),
        !isDefaultPolicy && (React.createElement(AmRoutesExpandedForm, { receivers: AmRouteReceivers, route: route, onSubmit: handleSave, actionButtons: React.createElement(Modal.ButtonRow, null,
                React.createElement(Button, { type: "button", variant: "secondary", onClick: handleDismiss, fill: "outline" }, "Cancel"),
                React.createElement(Button, { type: "submit" }, "Update policy")) })))), [AmRouteReceivers, alertManagerSourceName, handleDismiss, handleSave, isDefaultPolicy, loading, route, showModal]);
    return [modalElement, handleShow, handleDismiss];
};
const useDeletePolicyModal = (handleDelete, loading) => {
    const [showModal, setShowModal] = useState(false);
    const [route, setRoute] = useState();
    const handleDismiss = useCallback(() => {
        setRoute(undefined);
        setShowModal(false);
    }, [setRoute]);
    const handleShow = useCallback((route) => {
        setRoute(route);
        setShowModal(true);
    }, []);
    const handleSubmit = useCallback(() => {
        if (route) {
            handleDelete(route);
        }
    }, [handleDelete, route]);
    const modalElement = useMemo(() => loading ? (React.createElement(UpdatingModal, { isOpen: showModal })) : (React.createElement(Modal, { isOpen: showModal, onDismiss: handleDismiss, closeOnBackdropClick: true, closeOnEscape: true, title: "Delete notification policy" },
        React.createElement("p", null, "Deleting this notification policy will permanently remove it."),
        React.createElement("p", null, "Are you sure you want to delete this policy?"),
        React.createElement(Modal.ButtonRow, null,
            React.createElement(Button, { type: "button", variant: "destructive", onClick: handleSubmit }, "Yes, delete policy"),
            React.createElement(Button, { type: "button", variant: "secondary", onClick: handleDismiss }, "Cancel")))), [handleDismiss, handleSubmit, loading, showModal]);
    return [modalElement, handleShow, handleDismiss];
};
const useAlertGroupsModal = () => {
    const [showModal, setShowModal] = useState(false);
    const [alertGroups, setAlertGroups] = useState([]);
    const [matchers, setMatchers] = useState([]);
    const handleDismiss = useCallback(() => {
        setShowModal(false);
        setAlertGroups([]);
        setMatchers([]);
    }, []);
    const handleShow = useCallback((alertGroups, matchers) => {
        setAlertGroups(alertGroups);
        if (matchers) {
            setMatchers(matchers);
        }
        setShowModal(true);
    }, []);
    const instancesByState = useMemo(() => {
        const instances = alertGroups.flatMap((group) => group.alerts);
        return groupBy(instances, (instance) => instance.status.state);
    }, [alertGroups]);
    const modalElement = useMemo(() => {
        var _a, _b, _c;
        return (React.createElement(Modal, { isOpen: showModal, onDismiss: handleDismiss, closeOnBackdropClick: true, closeOnEscape: true, title: React.createElement(Stack, { direction: "row", alignItems: "center", gap: 1, flexGrow: 1 },
                React.createElement(Stack, { direction: "row", alignItems: "center", gap: 0.5 },
                    React.createElement(Icon, { name: "x" }),
                    " Matchers"),
                React.createElement(Matchers, { matchers: matchers })) },
            React.createElement(Stack, { direction: "column" },
                React.createElement(AlertGroupsSummary, { active: (_a = instancesByState[AlertState.Active]) === null || _a === void 0 ? void 0 : _a.length, suppressed: (_b = instancesByState[AlertState.Suppressed]) === null || _b === void 0 ? void 0 : _b.length, unprocessed: (_c = instancesByState[AlertState.Unprocessed]) === null || _c === void 0 ? void 0 : _c.length }),
                React.createElement("div", null, alertGroups.map((group, index) => (React.createElement(AlertGroup, { key: index, alertManagerSourceName: '', group: group }))))),
            React.createElement(Modal.ButtonRow, null,
                React.createElement(Button, { type: "button", variant: "secondary", onClick: handleDismiss }, "Cancel"))));
    }, [alertGroups, handleDismiss, instancesByState, matchers, showModal]);
    return [modalElement, handleShow, handleDismiss];
};
const UpdatingModal = ({ isOpen }) => (React.createElement(Modal, { isOpen: isOpen, onDismiss: () => { }, closeOnBackdropClick: false, closeOnEscape: false, title: React.createElement(Stack, { direction: "row", alignItems: "center", gap: 0.5 },
        "Updating... ",
        React.createElement(Spinner, { inline: true })) }, "Please wait while we update your notification policies."));
export { useAddPolicyModal, useDeletePolicyModal, useEditPolicyModal, useAlertGroupsModal };
//# sourceMappingURL=Modals.js.map