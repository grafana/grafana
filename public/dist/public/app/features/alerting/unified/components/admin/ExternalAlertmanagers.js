import { __assign, __makeTemplateObject, __read, __spreadArray } from "tslib";
import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { css } from '@emotion/css';
import { Button, ConfirmModal, HorizontalGroup, Icon, Tooltip, useStyles2 } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { AddAlertManagerModal } from './AddAlertManagerModal';
import { addExternalAlertmanagersAction, fetchExternalAlertmanagersAction, fetchExternalAlertmanagersConfigAction, } from '../../state/actions';
import { useExternalAmSelector } from '../../hooks/useExternalAmSelector';
export var ExternalAlertmanagers = function () {
    var styles = useStyles2(getStyles);
    var dispatch = useDispatch();
    var _a = __read(useState({ open: false, payload: [{ url: '' }] }), 2), modalState = _a[0], setModalState = _a[1];
    var _b = __read(useState({ open: false, index: 0 }), 2), deleteModalState = _b[0], setDeleteModalState = _b[1];
    var externalAlertManagers = useExternalAmSelector();
    useEffect(function () {
        dispatch(fetchExternalAlertmanagersAction());
        dispatch(fetchExternalAlertmanagersConfigAction());
        var interval = setInterval(function () { return dispatch(fetchExternalAlertmanagersAction()); }, 5000);
        return function () {
            clearInterval(interval);
        };
    }, [dispatch]);
    var onDelete = useCallback(function (index) {
        // to delete we need to filter the alertmanager from the list and repost
        var newList = externalAlertManagers
            .filter(function (am, i) { return i !== index; })
            .map(function (am) {
            return am.url;
        });
        dispatch(addExternalAlertmanagersAction(newList));
        setDeleteModalState({ open: false, index: 0 });
    }, [externalAlertManagers, dispatch]);
    var onEdit = useCallback(function () {
        var ams = externalAlertManagers ? __spreadArray([], __read(externalAlertManagers), false) : [{ url: '' }];
        setModalState(function (state) { return (__assign(__assign({}, state), { open: true, payload: ams })); });
    }, [setModalState, externalAlertManagers]);
    var onOpenModal = useCallback(function () {
        setModalState(function (state) {
            var ams = externalAlertManagers ? __spreadArray(__spreadArray([], __read(externalAlertManagers), false), [{ url: '' }], false) : [{ url: '' }];
            return __assign(__assign({}, state), { open: true, payload: ams });
        });
    }, [externalAlertManagers]);
    var onCloseModal = useCallback(function () {
        setModalState(function (state) { return (__assign(__assign({}, state), { open: false })); });
    }, [setModalState]);
    var getStatusColor = function (status) {
        switch (status) {
            case 'active':
                return 'green';
            case 'pending':
                return 'yellow';
            default:
                return 'red';
        }
    };
    var noAlertmanagers = (externalAlertManagers === null || externalAlertManagers === void 0 ? void 0 : externalAlertManagers.length) === 0;
    return (React.createElement("div", null,
        React.createElement("h4", null, "External Alertmanagers"),
        React.createElement("div", { className: styles.muted }, "If you are running Grafana in HA mode, you can point Prometheus to a list of Alertmanagers. Use the source URL input below to discover alertmanagers."),
        React.createElement("div", { className: styles.actions }, !noAlertmanagers && (React.createElement(Button, { type: "button", onClick: onOpenModal }, "Add Alertmanager"))),
        noAlertmanagers ? (React.createElement(EmptyListCTA, { title: "You have not added any external alertmanagers", onClick: onOpenModal, buttonTitle: "Add Alertmanager", buttonIcon: "bell-slash" })) : (React.createElement("table", { className: "filter-table form-inline filter-table--hover" },
            React.createElement("thead", null,
                React.createElement("tr", null,
                    React.createElement("th", null, "Url"),
                    React.createElement("th", null, "Status"),
                    React.createElement("th", { style: { width: '2%' } }, "Action"))),
            React.createElement("tbody", null, externalAlertManagers === null || externalAlertManagers === void 0 ? void 0 : externalAlertManagers.map(function (am, index) {
                return (React.createElement("tr", { key: index },
                    React.createElement("td", null,
                        React.createElement("span", { className: styles.url }, am.url),
                        React.createElement(Tooltip, { content: am.actualUrl, theme: "info" },
                            React.createElement(Icon, { name: "info-circle" }))),
                    React.createElement("td", null,
                        React.createElement(Icon, { name: "heart", style: { color: getStatusColor(am.status) }, title: am.status })),
                    React.createElement("td", null,
                        React.createElement(HorizontalGroup, null,
                            React.createElement(Button, { variant: "secondary", type: "button", onClick: onEdit, "aria-label": "Edit alertmanager" },
                                React.createElement(Icon, { name: "pen" })),
                            React.createElement(Button, { variant: "destructive", "aria-label": "Remove alertmanager", type: "button", onClick: function () { return setDeleteModalState({ open: true, index: index }); } },
                                React.createElement(Icon, { name: "trash-alt" }))))));
            })))),
        React.createElement(ConfirmModal, { isOpen: deleteModalState.open, title: "Remove Alertmanager", body: "Are you sure you want to remove this Alertmanager", confirmText: "Remove", onConfirm: function () { return onDelete(deleteModalState.index); }, onDismiss: function () { return setDeleteModalState({ open: false, index: 0 }); } }),
        modalState.open && React.createElement(AddAlertManagerModal, { onClose: onCloseModal, alertmanagers: modalState.payload })));
};
var getStyles = function (theme) { return ({
    url: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin-right: ", ";\n  "], ["\n    margin-right: ", ";\n  "])), theme.spacing(1)),
    muted: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.colors.text.secondary),
    actions: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    margin-top: ", ";\n    display: flex;\n    justify-content: flex-end;\n  "], ["\n    margin-top: ", ";\n    display: flex;\n    justify-content: flex-end;\n  "])), theme.spacing(2)),
    table: css(templateObject_4 || (templateObject_4 = __makeTemplateObject([""], [""]))),
}); };
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=ExternalAlertmanagers.js.map