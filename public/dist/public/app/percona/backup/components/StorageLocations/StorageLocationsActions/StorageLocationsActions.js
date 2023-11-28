import React from 'react';
import { Tooltip, useStyles2 } from '@grafana/ui';
import { MultipleActions } from 'app/percona/dbaas/components/MultipleActions';
import { ExpandableRowButton } from 'app/percona/shared/components/Elements/ExpandableRowButton/ExpandableRowButton';
import { DBIcon } from '../../DBIcon';
import { Messages } from './StorageLocationsActions.messages';
import { getStyles } from './StorageLocationsActions.styles';
export const StorageLocationsActions = ({ row, location, onUpdate, onDelete }) => {
    const styles = useStyles2(getStyles);
    const handleUpdateClick = () => onUpdate(location);
    const onDeleteClick = () => onDelete(location);
    const getActions = [
        {
            content: (React.createElement("div", { className: styles.dropdownField },
                React.createElement(DBIcon, { type: "edit", "data-testid": "edit-storage-location-button", role: "button" }),
                Messages.editStorageLocation)),
            action: handleUpdateClick,
        },
        {
            content: (React.createElement("div", { className: styles.dropdownField },
                React.createElement(DBIcon, { type: "delete", "data-testid": "delete-storage-location-button", role: "button" }),
                Messages.deleteStorageLocation)),
            action: onDeleteClick,
        },
    ];
    return (React.createElement("div", { className: styles.actionsWrapper },
        React.createElement(Tooltip, { content: Messages.details, placement: "top" },
            React.createElement("span", null,
                React.createElement(ExpandableRowButton, { row: row }))),
        React.createElement(MultipleActions, { actions: getActions, dataTestId: "storage-location-actions" })));
};
//# sourceMappingURL=StorageLocationsActions.js.map