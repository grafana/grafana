import pluralize from 'pluralize';
import React, { useMemo, useState } from 'react';
import { useToggle } from 'react-use';
import { dateTime, dateTimeFormat } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Badge, Button, ConfirmModal, Icon, Modal, useStyles2 } from '@grafana/ui';
import { useDispatch } from 'app/types';
import { useGetContactPointsState } from '../../api/receiversApi';
import { Authorize } from '../../components/Authorize';
import { AlertmanagerAction, useAlertmanagerAbility } from '../../hooks/useAbilities';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { deleteReceiverAction } from '../../state/actions';
import { getAlertTableStyles } from '../../styles/table';
import { isReceiverUsed } from '../../utils/alertmanager';
import { GRAFANA_RULES_SOURCE_NAME, isVanillaPrometheusAlertManagerDataSource } from '../../utils/datasource';
import { makeAMLink } from '../../utils/misc';
import { extractNotifierTypeCounts } from '../../utils/receivers';
import { DynamicTable } from '../DynamicTable';
import { ProvisioningBadge } from '../Provisioning';
import { GrafanaReceiverExporter } from '../export/GrafanaReceiverExporter';
import { ActionIcon } from '../rules/ActionIcon';
import { ReceiversSection } from './ReceiversSection';
import { ReceiverMetadataBadge } from './grafanaAppReceivers/ReceiverMetadataBadge';
import { useReceiversMetadata } from './grafanaAppReceivers/useReceiversMetadata';
import { useAlertmanagerConfigHealth } from './useAlertmanagerConfigHealth';
function UpdateActions({ alertManagerName, receiverName, onClickDeleteReceiver }) {
    return (React.createElement(React.Fragment, null,
        React.createElement(Authorize, { actions: [AlertmanagerAction.UpdateContactPoint] },
            React.createElement(ActionIcon, { "aria-label": "Edit", "data-testid": "edit", to: makeAMLink(`/alerting/notifications/receivers/${encodeURIComponent(receiverName)}/edit`, alertManagerName), tooltip: "Edit contact point", icon: "pen" })),
        React.createElement(Authorize, { actions: [AlertmanagerAction.DeleteContactPoint] },
            React.createElement(ActionIcon, { onClick: () => onClickDeleteReceiver(receiverName), tooltip: "Delete contact point", icon: "trash-alt" }))));
}
function ViewAction({ alertManagerName, receiverName }) {
    return (React.createElement(Authorize, { actions: [AlertmanagerAction.UpdateContactPoint] },
        React.createElement(ActionIcon, { "data-testid": "view", to: makeAMLink(`/alerting/notifications/receivers/${encodeURIComponent(receiverName)}/edit`, alertManagerName), tooltip: "View contact point", icon: "file-alt" })));
}
function ExportAction({ receiverName, canReadSecrets = false }) {
    const [showExportDrawer, toggleShowExportDrawer] = useToggle(false);
    return (React.createElement(Authorize, { actions: [AlertmanagerAction.ExportContactPoint] },
        React.createElement(ActionIcon, { "data-testid": "export", tooltip: canReadSecrets ? 'Export contact point with decrypted secrets' : 'Export contact point with redacted secrets', icon: "download-alt", onClick: toggleShowExportDrawer }),
        showExportDrawer && (React.createElement(GrafanaReceiverExporter, { receiverName: receiverName, decrypt: canReadSecrets, onClose: toggleShowExportDrawer }))));
}
function ReceiverError({ errorCount, errorDetail, showErrorCount, tooltip }) {
    var _a;
    const text = showErrorCount ? `${errorCount} ${pluralize('error', errorCount)}` : 'Error';
    const tooltipToRender = (_a = tooltip !== null && tooltip !== void 0 ? tooltip : errorDetail) !== null && _a !== void 0 ? _a : 'Error';
    return React.createElement(Badge, { color: "red", icon: "exclamation-circle", text: text, tooltip: tooltipToRender });
}
function NotifierHealth({ errorsByNotifier, errorDetail, lastNotify }) {
    const hasErrors = errorsByNotifier > 0;
    const noAttempts = isLastNotifyNullDate(lastNotify);
    if (hasErrors) {
        return React.createElement(ReceiverError, { errorCount: errorsByNotifier, errorDetail: errorDetail, showErrorCount: false });
    }
    if (noAttempts) {
        return React.createElement(React.Fragment, null, "No attempts");
    }
    return React.createElement(Badge, { color: "green", text: "OK" });
}
function ReceiverHealth({ errorsByReceiver, someWithNoAttempt }) {
    const hasErrors = errorsByReceiver > 0;
    if (hasErrors) {
        return (React.createElement(ReceiverError, { errorCount: errorsByReceiver, showErrorCount: true, tooltip: "Expand the contact point to see error details." }));
    }
    if (someWithNoAttempt) {
        return React.createElement(React.Fragment, null, "No attempts");
    }
    return React.createElement(Badge, { color: "green", text: "OK" });
}
const useContactPointsState = (alertManagerName) => {
    var _a;
    const contactPointsState = useGetContactPointsState(alertManagerName);
    const receivers = (_a = contactPointsState === null || contactPointsState === void 0 ? void 0 : contactPointsState.receivers) !== null && _a !== void 0 ? _a : {};
    const errorStateAvailable = Object.keys(receivers).length > 0;
    return { contactPointsState, errorStateAvailable };
};
const isLastNotifyNullDate = (lastNotify) => lastNotify === '0001-01-01T00:00:00.000Z';
function LastNotify({ lastNotifyDate }) {
    if (isLastNotifyNullDate(lastNotifyDate)) {
        return React.createElement(React.Fragment, null, '-');
    }
    else {
        return (React.createElement(Stack, { alignItems: "center" },
            React.createElement("div", null, `${dateTime(lastNotifyDate).locale('en').fromNow(true)} ago`),
            React.createElement(Icon, { name: "clock-nine" }),
            React.createElement("div", null, `${dateTimeFormat(lastNotifyDate, { format: 'YYYY-MM-DD HH:mm:ss' })}`)));
    }
}
const possibleNullDurations = ['', '0', '0ms', '0s', '0m', '0h', '0d', '0w', '0y'];
const durationIsNull = (duration) => possibleNullDurations.includes(duration);
function NotifiersTable({ notifiersState }) {
    function getNotifierColumns() {
        return [
            {
                id: 'health',
                label: 'Health',
                renderCell: ({ data: { lastError, lastNotify } }) => {
                    return (React.createElement(NotifierHealth, { errorsByNotifier: lastError ? 1 : 0, errorDetail: lastError !== null && lastError !== void 0 ? lastError : undefined, lastNotify: lastNotify }));
                },
                size: 0.5,
            },
            {
                id: 'name',
                label: 'Name',
                renderCell: ({ data: { type }, id }) => React.createElement(React.Fragment, null, `${type}[${id}]`),
                size: 1,
            },
            {
                id: 'lastNotify',
                label: 'Last delivery attempt',
                renderCell: ({ data: { lastNotify } }) => React.createElement(LastNotify, { lastNotifyDate: lastNotify }),
                size: 3,
            },
            {
                id: 'lastNotifyDuration',
                label: 'Last duration',
                renderCell: ({ data: { lastNotify, lastNotifyDuration } }) => (React.createElement(React.Fragment, null, isLastNotifyNullDate(lastNotify) && durationIsNull(lastNotifyDuration) ? '-' : lastNotifyDuration)),
                size: 1,
            },
            {
                id: 'sendResolved',
                label: 'Send resolved',
                renderCell: ({ data: { sendResolved } }) => React.createElement(React.Fragment, null, String(Boolean(sendResolved))),
                size: 1,
            },
        ];
    }
    const notifierRows = Object.entries(notifiersState).flatMap((typeState) => typeState[1].map((notifierStatus, index) => {
        return {
            id: index,
            data: {
                type: typeState[0],
                lastError: notifierStatus.lastNotifyAttemptError,
                lastNotify: notifierStatus.lastNotifyAttempt,
                lastNotifyDuration: notifierStatus.lastNotifyAttemptDuration,
                sendResolved: notifierStatus.sendResolved,
            },
        };
    }));
    return React.createElement(DynamicTable, { items: notifierRows, cols: getNotifierColumns(), pagination: { itemsPerPage: 25 } });
}
export const ReceiversTable = ({ config, alertManagerName }) => {
    var _a;
    const dispatch = useDispatch();
    const isVanillaAM = isVanillaPrometheusAlertManagerDataSource(alertManagerName);
    const grafanaNotifiers = useUnifiedAlertingSelector((state) => state.grafanaNotifiers);
    const configHealth = useAlertmanagerConfigHealth(config.alertmanager_config);
    const { contactPointsState, errorStateAvailable } = useContactPointsState(alertManagerName);
    const receiversMetadata = useReceiversMetadata((_a = config.alertmanager_config.receivers) !== null && _a !== void 0 ? _a : []);
    // receiver name slated for deletion. If this is set, a confirmation modal is shown. If user approves, this receiver is deleted
    const [receiverToDelete, setReceiverToDelete] = useState();
    const [showCannotDeleteReceiverModal, setShowCannotDeleteReceiverModal] = useState(false);
    const [supportsExport, allowedToExport] = useAlertmanagerAbility(AlertmanagerAction.ExportContactPoint);
    const showExport = supportsExport && allowedToExport;
    const onClickDeleteReceiver = (receiverName) => {
        if (isReceiverUsed(receiverName, config)) {
            setShowCannotDeleteReceiverModal(true);
        }
        else {
            setReceiverToDelete(receiverName);
        }
    };
    const deleteReceiver = () => {
        if (receiverToDelete) {
            dispatch(deleteReceiverAction(receiverToDelete, alertManagerName));
        }
        setReceiverToDelete(undefined);
    };
    const rows = useMemo(() => {
        var _a, _b;
        const receivers = (_a = config.alertmanager_config.receivers) !== null && _a !== void 0 ? _a : [];
        return ((_b = receivers.map((receiver) => {
            var _a, _b;
            return ({
                id: receiver.name,
                data: {
                    name: receiver.name,
                    types: Object.entries(extractNotifierTypeCounts(receiver, (_a = grafanaNotifiers.result) !== null && _a !== void 0 ? _a : [])).map(([type, count]) => {
                        if (count > 1) {
                            return `${type} (${count})`;
                        }
                        return type;
                    }),
                    provisioned: (_b = receiver.grafana_managed_receiver_configs) === null || _b === void 0 ? void 0 : _b.some((receiver) => receiver.provenance),
                    metadata: receiversMetadata.get(receiver),
                },
            });
        })) !== null && _b !== void 0 ? _b : []);
    }, [grafanaNotifiers.result, config.alertmanager_config, receiversMetadata]);
    const [createSupported, createAllowed] = useAlertmanagerAbility(AlertmanagerAction.CreateContactPoint);
    const [_, canReadSecrets] = useAlertmanagerAbility(AlertmanagerAction.DecryptSecrets);
    const columns = useGetColumns(alertManagerName, errorStateAvailable, contactPointsState, configHealth, onClickDeleteReceiver, isVanillaAM, canReadSecrets);
    return (React.createElement(ReceiversSection, { canReadSecrets: canReadSecrets, title: "Contact points", description: "Define where notifications are sent, for example, email or Slack.", showButton: createSupported && createAllowed, addButtonLabel: 'Add contact point', addButtonTo: makeAMLink('/alerting/notifications/receivers/new', alertManagerName), showExport: showExport },
        React.createElement(DynamicTable, { pagination: { itemsPerPage: 25 }, items: rows, cols: columns, isExpandable: errorStateAvailable, renderExpandedContent: errorStateAvailable
                ? ({ data: { name } }) => {
                    var _a, _b;
                    return (React.createElement(NotifiersTable, { notifiersState: (_b = (_a = contactPointsState === null || contactPointsState === void 0 ? void 0 : contactPointsState.receivers[name]) === null || _a === void 0 ? void 0 : _a.notifiers) !== null && _b !== void 0 ? _b : {} }));
                }
                : undefined }),
        !!showCannotDeleteReceiverModal && (React.createElement(Modal, { isOpen: true, title: "Cannot delete contact point", onDismiss: () => setShowCannotDeleteReceiverModal(false) },
            React.createElement("p", null, "Contact point cannot be deleted because it is used in more policies. Please update or delete these policies first."),
            React.createElement(Modal.ButtonRow, null,
                React.createElement(Button, { variant: "secondary", onClick: () => setShowCannotDeleteReceiverModal(false), fill: "outline" }, "Close")))),
        !!receiverToDelete && (React.createElement(ConfirmModal, { isOpen: true, title: "Delete contact point", body: `Are you sure you want to delete contact point "${receiverToDelete}"?`, confirmText: "Yes, delete", onConfirm: deleteReceiver, onDismiss: () => setReceiverToDelete(undefined) }))));
};
const errorsByReceiver = (contactPointsState, receiverName) => { var _a, _b; return (_b = (_a = contactPointsState === null || contactPointsState === void 0 ? void 0 : contactPointsState.receivers[receiverName]) === null || _a === void 0 ? void 0 : _a.errorCount) !== null && _b !== void 0 ? _b : 0; };
const someNotifiersWithNoAttempt = (contactPointsState, receiverName) => {
    var _a, _b;
    const notifiers = Object.values((_b = (_a = contactPointsState === null || contactPointsState === void 0 ? void 0 : contactPointsState.receivers[receiverName]) === null || _a === void 0 ? void 0 : _a.notifiers) !== null && _b !== void 0 ? _b : {});
    if (notifiers.length === 0) {
        return false;
    }
    const hasSomeWitNoAttempt = notifiers.flat().some((status) => isLastNotifyNullDate(status.lastNotifyAttempt));
    return hasSomeWitNoAttempt;
};
function useGetColumns(alertManagerName, errorStateAvailable, contactPointsState, configHealth, onClickDeleteReceiver, isVanillaAM, canReadSecrets) {
    const tableStyles = useStyles2(getAlertTableStyles);
    const enableHealthColumn = errorStateAvailable || Object.values(configHealth.contactPoints).some((cp) => cp.matchingRoutes === 0);
    const isGrafanaAlertManager = alertManagerName === GRAFANA_RULES_SOURCE_NAME;
    const baseColumns = [
        {
            id: 'name',
            label: 'Contact point name',
            renderCell: ({ data: { name, provisioned } }) => (React.createElement(React.Fragment, null,
                React.createElement("div", null, name),
                provisioned && React.createElement(ProvisioningBadge, null))),
            size: 3,
            className: tableStyles.nameCell,
        },
        {
            id: 'type',
            label: 'Type',
            renderCell: ({ data: { types, metadata } }) => (React.createElement(React.Fragment, null, metadata ? React.createElement(ReceiverMetadataBadge, { metadata: metadata }) : types.join(', '))),
            size: 2,
        },
    ];
    const healthColumn = {
        id: 'health',
        label: 'Health',
        renderCell: ({ data: { name } }) => {
            var _a;
            if (((_a = configHealth.contactPoints[name]) === null || _a === void 0 ? void 0 : _a.matchingRoutes) === 0) {
                return React.createElement(UnusedContactPointBadge, null);
            }
            return (contactPointsState &&
                Object.entries(contactPointsState.receivers).length > 0 && (React.createElement(ReceiverHealth, { errorsByReceiver: errorsByReceiver(contactPointsState, name), someWithNoAttempt: someNotifiersWithNoAttempt(contactPointsState, name) })));
        },
        size: '160px',
    };
    return [
        ...baseColumns,
        ...(enableHealthColumn ? [healthColumn] : []),
        {
            id: 'actions',
            label: 'Actions',
            renderCell: ({ data: { provisioned, name } }) => (React.createElement(Authorize, { actions: [
                    AlertmanagerAction.UpdateContactPoint,
                    AlertmanagerAction.DeleteContactPoint,
                    AlertmanagerAction.ExportContactPoint,
                ] },
                React.createElement("div", { className: tableStyles.actionsCell },
                    !isVanillaAM && !provisioned && (React.createElement(UpdateActions, { alertManagerName: alertManagerName, receiverName: name, onClickDeleteReceiver: onClickDeleteReceiver })),
                    (isVanillaAM || provisioned) && React.createElement(ViewAction, { alertManagerName: alertManagerName, receiverName: name }),
                    isGrafanaAlertManager && (React.createElement(ExportAction, { alertManagerName: alertManagerName, receiverName: name, canReadSecrets: canReadSecrets }))))),
            size: '100px',
        },
    ];
}
export function UnusedContactPointBadge() {
    return (React.createElement(Badge, { text: "Unused", color: "orange", icon: "exclamation-triangle", tooltip: "This contact point is not used in any notification policy and it will not receive any alerts" }));
}
//# sourceMappingURL=ReceiversTable.js.map