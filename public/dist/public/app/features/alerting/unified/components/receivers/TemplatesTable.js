import React, { Fragment, useMemo, useState } from 'react';
import { ConfirmModal, useStyles2 } from '@grafana/ui';
import { useDispatch } from 'app/types';
import { Authorize } from '../../components/Authorize';
import { AlertmanagerAction } from '../../hooks/useAbilities';
import { deleteTemplateAction } from '../../state/actions';
import { getAlertTableStyles } from '../../styles/table';
import { makeAMLink } from '../../utils/misc';
import { CollapseToggle } from '../CollapseToggle';
import { DetailsField } from '../DetailsField';
import { ProvisioningBadge } from '../Provisioning';
import { ActionIcon } from '../rules/ActionIcon';
import { TemplateEditor } from './TemplateEditor';
export const TemplatesTable = ({ config, alertManagerName }) => {
    const dispatch = useDispatch();
    const [expandedTemplates, setExpandedTemplates] = useState({});
    const tableStyles = useStyles2(getAlertTableStyles);
    const templateRows = useMemo(() => {
        const templates = Object.entries(config.template_files);
        return templates.map(([name, template]) => {
            var _a;
            return ({
                name,
                template,
                provenance: ((_a = config.template_file_provenances) !== null && _a !== void 0 ? _a : {})[name],
            });
        });
    }, [config]);
    const [templateToDelete, setTemplateToDelete] = useState();
    const deleteTemplate = () => {
        if (templateToDelete) {
            dispatch(deleteTemplateAction(templateToDelete, alertManagerName));
        }
        setTemplateToDelete(undefined);
    };
    return (React.createElement(React.Fragment, null,
        React.createElement("table", { className: tableStyles.table, "data-testid": "templates-table" },
            React.createElement("colgroup", null,
                React.createElement("col", { className: tableStyles.colExpand }),
                React.createElement("col", null),
                React.createElement("col", null)),
            React.createElement("thead", null,
                React.createElement("tr", null,
                    React.createElement("th", null),
                    React.createElement("th", null, "Template"),
                    React.createElement(Authorize, { actions: [
                            AlertmanagerAction.CreateNotificationTemplate,
                            AlertmanagerAction.UpdateNotificationTemplate,
                            AlertmanagerAction.DeleteNotificationTemplate,
                        ] },
                        React.createElement("th", null, "Actions")))),
            React.createElement("tbody", null,
                !templateRows.length && (React.createElement("tr", { className: tableStyles.evenRow },
                    React.createElement("td", { colSpan: 3 }, "No templates defined."))),
                templateRows.map(({ name, template, provenance }, idx) => {
                    const isExpanded = !!expandedTemplates[name];
                    return (React.createElement(Fragment, { key: name },
                        React.createElement("tr", { key: name, className: idx % 2 === 0 ? tableStyles.evenRow : undefined },
                            React.createElement("td", null,
                                React.createElement(CollapseToggle, { isCollapsed: !expandedTemplates[name], onToggle: () => setExpandedTemplates(Object.assign(Object.assign({}, expandedTemplates), { [name]: !isExpanded })) })),
                            React.createElement("td", null,
                                name,
                                " ",
                                provenance && React.createElement(ProvisioningBadge, null)),
                            React.createElement("td", { className: tableStyles.actionsCell },
                                provenance && (React.createElement(ActionIcon, { to: makeAMLink(`/alerting/notifications/templates/${encodeURIComponent(name)}/edit`, alertManagerName), tooltip: "view template", icon: "file-alt" })),
                                !provenance && (React.createElement(Authorize, { actions: [AlertmanagerAction.UpdateNotificationTemplate] },
                                    React.createElement(ActionIcon, { to: makeAMLink(`/alerting/notifications/templates/${encodeURIComponent(name)}/edit`, alertManagerName), tooltip: "edit template", icon: "pen" }))),
                                React.createElement(Authorize, { actions: [AlertmanagerAction.CreateContactPoint] },
                                    React.createElement(ActionIcon, { to: makeAMLink(`/alerting/notifications/templates/${encodeURIComponent(name)}/duplicate`, alertManagerName), tooltip: "Copy template", icon: "copy" })),
                                !provenance && (React.createElement(Authorize, { actions: [AlertmanagerAction.DeleteNotificationTemplate] },
                                    React.createElement(ActionIcon, { onClick: () => setTemplateToDelete(name), tooltip: "delete template", icon: "trash-alt" }))))),
                        isExpanded && (React.createElement("tr", { className: idx % 2 === 0 ? tableStyles.evenRow : undefined },
                            React.createElement("td", null),
                            React.createElement("td", { colSpan: 2 },
                                React.createElement(DetailsField, { label: "Description", horizontal: true },
                                    React.createElement(TemplateEditor, { width: 'auto', height: 'auto', autoHeight: true, value: template, showLineNumbers: false, monacoOptions: {
                                            readOnly: true,
                                            scrollBeyondLastLine: false,
                                        } })))))));
                }))),
        !!templateToDelete && (React.createElement(ConfirmModal, { isOpen: true, title: "Delete template", body: `Are you sure you want to delete template "${templateToDelete}"?`, confirmText: "Yes, delete", onConfirm: deleteTemplate, onDismiss: () => setTemplateToDelete(undefined) }))));
};
//# sourceMappingURL=TemplatesTable.js.map