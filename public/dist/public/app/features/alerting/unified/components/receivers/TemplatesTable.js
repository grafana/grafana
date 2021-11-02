import { __assign, __read } from "tslib";
import { ConfirmModal, useStyles2 } from '@grafana/ui';
import React, { Fragment, useMemo, useState } from 'react';
import { getAlertTableStyles } from '../../styles/table';
import { CollapseToggle } from '../CollapseToggle';
import { DetailsField } from '../DetailsField';
import { ActionIcon } from '../rules/ActionIcon';
import { ReceiversSection } from './ReceiversSection';
import { makeAMLink } from '../../utils/misc';
import { useDispatch } from 'react-redux';
import { deleteTemplateAction } from '../../state/actions';
export var TemplatesTable = function (_a) {
    var config = _a.config, alertManagerName = _a.alertManagerName;
    var dispatch = useDispatch();
    var _b = __read(useState({}), 2), expandedTemplates = _b[0], setExpandedTemplates = _b[1];
    var tableStyles = useStyles2(getAlertTableStyles);
    var templateRows = useMemo(function () { return Object.entries(config.template_files); }, [config]);
    var _c = __read(useState(), 2), templateToDelete = _c[0], setTemplateToDelete = _c[1];
    var deleteTemplate = function () {
        if (templateToDelete) {
            dispatch(deleteTemplateAction(templateToDelete, alertManagerName));
        }
        setTemplateToDelete(undefined);
    };
    return (React.createElement(ReceiversSection, { title: "Message templates", description: "Templates construct the messages that get sent to the contact points.", addButtonLabel: "New template", addButtonTo: makeAMLink('/alerting/notifications/templates/new', alertManagerName) },
        React.createElement("table", { className: tableStyles.table, "data-testid": "templates-table" },
            React.createElement("colgroup", null,
                React.createElement("col", { className: tableStyles.colExpand }),
                React.createElement("col", null),
                React.createElement("col", null)),
            React.createElement("thead", null,
                React.createElement("tr", null,
                    React.createElement("th", null),
                    React.createElement("th", null, "Template"),
                    React.createElement("th", null, "Actions"))),
            React.createElement("tbody", null,
                !templateRows.length && (React.createElement("tr", { className: tableStyles.evenRow },
                    React.createElement("td", { colSpan: 3 }, "No templates defined."))),
                templateRows.map(function (_a, idx) {
                    var _b = __read(_a, 2), name = _b[0], content = _b[1];
                    var isExpanded = !!expandedTemplates[name];
                    return (React.createElement(Fragment, { key: name },
                        React.createElement("tr", { key: name, className: idx % 2 === 0 ? tableStyles.evenRow : undefined },
                            React.createElement("td", null,
                                React.createElement(CollapseToggle, { isCollapsed: !expandedTemplates[name], onToggle: function () {
                                        var _a;
                                        return setExpandedTemplates(__assign(__assign({}, expandedTemplates), (_a = {}, _a[name] = !isExpanded, _a)));
                                    } })),
                            React.createElement("td", null, name),
                            React.createElement("td", { className: tableStyles.actionsCell },
                                React.createElement(ActionIcon, { to: makeAMLink("/alerting/notifications/templates/" + encodeURIComponent(name) + "/edit", alertManagerName), tooltip: "edit template", icon: "pen" }),
                                React.createElement(ActionIcon, { onClick: function () { return setTemplateToDelete(name); }, tooltip: "delete template", icon: "trash-alt" }))),
                        isExpanded && (React.createElement("tr", { className: idx % 2 === 0 ? tableStyles.evenRow : undefined },
                            React.createElement("td", null),
                            React.createElement("td", { colSpan: 2 },
                                React.createElement(DetailsField, { label: "Description", horizontal: true },
                                    React.createElement("pre", null, content)))))));
                }))),
        !!templateToDelete && (React.createElement(ConfirmModal, { isOpen: true, title: "Delete template", body: "Are you sure you want to delete template \"" + templateToDelete + "\"?", confirmText: "Yes, delete", onConfirm: deleteTemplate, onDismiss: function () { return setTemplateToDelete(undefined); } }))));
};
//# sourceMappingURL=TemplatesTable.js.map