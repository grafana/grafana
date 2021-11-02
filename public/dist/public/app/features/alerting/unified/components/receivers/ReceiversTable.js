import { __makeTemplateObject, __read } from "tslib";
import { Button, ConfirmModal, Modal, useStyles2 } from '@grafana/ui';
import React, { useMemo, useState } from 'react';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { getAlertTableStyles } from '../../styles/table';
import { extractNotifierTypeCounts } from '../../utils/receivers';
import { ActionIcon } from '../rules/ActionIcon';
import { ReceiversSection } from './ReceiversSection';
import { makeAMLink } from '../../utils/misc';
import { css } from '@emotion/css';
import { isReceiverUsed } from '../../utils/alertmanager';
import { useDispatch } from 'react-redux';
import { deleteReceiverAction } from '../../state/actions';
import { isVanillaPrometheusAlertManagerDataSource } from '../../utils/datasource';
export var ReceiversTable = function (_a) {
    var config = _a.config, alertManagerName = _a.alertManagerName;
    var dispatch = useDispatch();
    var tableStyles = useStyles2(getAlertTableStyles);
    var styles = useStyles2(getStyles);
    var isVanillaAM = isVanillaPrometheusAlertManagerDataSource(alertManagerName);
    var grafanaNotifiers = useUnifiedAlertingSelector(function (state) { return state.grafanaNotifiers; });
    // receiver name slated for deletion. If this is set, a confirmation modal is shown. If user approves, this receiver is deleted
    var _b = __read(useState(), 2), receiverToDelete = _b[0], setReceiverToDelete = _b[1];
    var _c = __read(useState(false), 2), showCannotDeleteReceiverModal = _c[0], setShowCannotDeleteReceiverModal = _c[1];
    var onClickDeleteReceiver = function (receiverName) {
        if (isReceiverUsed(receiverName, config)) {
            setShowCannotDeleteReceiverModal(true);
        }
        else {
            setReceiverToDelete(receiverName);
        }
    };
    var deleteReceiver = function () {
        if (receiverToDelete) {
            dispatch(deleteReceiverAction(receiverToDelete, alertManagerName));
        }
        setReceiverToDelete(undefined);
    };
    var rows = useMemo(function () {
        var _a, _b;
        return (_b = (_a = config.alertmanager_config.receivers) === null || _a === void 0 ? void 0 : _a.map(function (receiver) {
            var _a;
            return ({
                name: receiver.name,
                types: Object.entries(extractNotifierTypeCounts(receiver, (_a = grafanaNotifiers.result) !== null && _a !== void 0 ? _a : [])).map(function (_a) {
                    var _b = __read(_a, 2), type = _b[0], count = _b[1];
                    if (count > 1) {
                        return type + " (" + count + ")";
                    }
                    return type;
                }),
            });
        })) !== null && _b !== void 0 ? _b : [];
    }, [config, grafanaNotifiers.result]);
    return (React.createElement(ReceiversSection, { className: styles.section, title: "Contact points", description: "Define where the notifications will be sent to, for example email or Slack.", showButton: !isVanillaAM, addButtonLabel: "New contact point", addButtonTo: makeAMLink('/alerting/notifications/receivers/new', alertManagerName) },
        React.createElement("table", { className: tableStyles.table, "data-testid": "receivers-table" },
            React.createElement("colgroup", null,
                React.createElement("col", null),
                React.createElement("col", null),
                React.createElement("col", null)),
            React.createElement("thead", null,
                React.createElement("tr", null,
                    React.createElement("th", null, "Contact point name"),
                    React.createElement("th", null, "Type"),
                    React.createElement("th", null, "Actions"))),
            React.createElement("tbody", null,
                !rows.length && (React.createElement("tr", { className: tableStyles.evenRow },
                    React.createElement("td", { colSpan: 3 }, "No receivers defined."))),
                rows.map(function (receiver, idx) { return (React.createElement("tr", { key: receiver.name, className: idx % 2 === 0 ? tableStyles.evenRow : undefined },
                    React.createElement("td", null, receiver.name),
                    React.createElement("td", null, receiver.types.join(', ')),
                    React.createElement("td", { className: tableStyles.actionsCell },
                        !isVanillaAM && (React.createElement(React.Fragment, null,
                            React.createElement(ActionIcon, { "data-testid": "edit", to: makeAMLink("/alerting/notifications/receivers/" + encodeURIComponent(receiver.name) + "/edit", alertManagerName), tooltip: "Edit contact point", icon: "pen" }),
                            React.createElement(ActionIcon, { onClick: function () { return onClickDeleteReceiver(receiver.name); }, tooltip: "Delete contact point", icon: "trash-alt" }))),
                        isVanillaAM && (React.createElement(ActionIcon, { "data-testid": "view", to: makeAMLink("/alerting/notifications/receivers/" + encodeURIComponent(receiver.name) + "/edit", alertManagerName), tooltip: "View contact point", icon: "file-alt" }))))); }))),
        !!showCannotDeleteReceiverModal && (React.createElement(Modal, { isOpen: true, title: "Cannot delete contact point", onDismiss: function () { return setShowCannotDeleteReceiverModal(false); } },
            React.createElement("p", null, "Contact point cannot be deleted because it is used in more policies. Please update or delete these policies first."),
            React.createElement(Modal.ButtonRow, null,
                React.createElement(Button, { variant: "secondary", onClick: function () { return setShowCannotDeleteReceiverModal(false); }, fill: "outline" }, "Close")))),
        !!receiverToDelete && (React.createElement(ConfirmModal, { isOpen: true, title: "Delete contact point", body: "Are you sure you want to delete contact point \"" + receiverToDelete + "\"?", confirmText: "Yes, delete", onConfirm: deleteReceiver, onDismiss: function () { return setReceiverToDelete(undefined); } }))));
};
var getStyles = function (theme) { return ({
    section: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin-top: ", ";\n  "], ["\n    margin-top: ", ";\n  "])), theme.spacing(4)),
}); };
var templateObject_1;
//# sourceMappingURL=ReceiversTable.js.map