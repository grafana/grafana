import React from 'react';
import { Icon, Spinner, Switch, Tooltip, useStyles2 } from '@grafana/ui';
import { MultipleActions } from 'app/percona/dbaas/components/MultipleActions';
import { ExpandableRowButton } from 'app/percona/shared/components/Elements/ExpandableRowButton/ExpandableRowButton';
import { Messages } from './ScheduledBackupsActions.messages';
import { getStyles } from './ScheduledBackupsActions.styles';
export const ScheduledBackupsActions = ({ row, backup, onEdit = () => { }, onCopy = () => { }, onDelete = () => { }, onToggle = () => { }, pending, }) => {
    const styles = useStyles2(getStyles);
    const handleEdit = () => onEdit(backup);
    const handleDelete = () => onDelete(backup);
    const handleCopy = () => onCopy(backup);
    const handleToggle = () => onToggle(backup);
    const getActions = [
        {
            content: (React.createElement("div", { className: styles.dropdownField },
                React.createElement(Icon, { "data-testid": "copy-scheduled-backup-button", name: "copy" }),
                Messages.copy)),
            action: handleCopy,
        },
        {
            content: (React.createElement("div", { className: styles.dropdownField },
                React.createElement(Icon, { "data-testid": "edit-scheduled-backpup-button", name: "pen" }),
                Messages.edit)),
            action: handleEdit,
        },
        {
            content: (React.createElement("div", { className: styles.dropdownField },
                React.createElement(Icon, { "data-testid": "delete-scheduled-backpup-button", name: "times" }),
                Messages.delete)),
            action: handleDelete,
        },
    ];
    return (React.createElement("div", { className: styles.actionsWrapper }, pending ? (React.createElement(Spinner, null)) : (React.createElement(React.Fragment, null,
        React.createElement("span", null,
            React.createElement(Switch, { value: backup.enabled, onClick: handleToggle, "data-testid": "toggle-scheduled-backpup" })),
        React.createElement(Tooltip, { content: Messages.details, placement: "top" },
            React.createElement("span", null,
                React.createElement(ExpandableRowButton, { row: row }))),
        React.createElement(MultipleActions, { actions: getActions, dataTestId: "scheduled-backups-actions" })))));
};
//# sourceMappingURL=ScheduledBackupsActions.js.map