import React from 'react';
import { Tooltip, useStyles2 } from '@grafana/ui';
import { BackupStatus } from 'app/percona/backup/Backup.types';
import { MultipleActions } from 'app/percona/dbaas/components/MultipleActions';
import { ExpandableRowButton } from 'app/percona/shared/components/Elements/ExpandableRowButton/ExpandableRowButton';
import { DBIcon } from '../../DBIcon';
import { Messages } from './BackupInventoryActions.messages';
import { getStyles } from './BackupInventoryActions.styles';
export const BackupInventoryActions = ({ row, backup, onRestore, onBackup, onDelete, }) => {
    const styles = useStyles2(getStyles);
    const handeClick = () => onRestore(backup);
    // TODO uncomment when there's definition for this action
    // const handleBackup = () => onBackup(backup);
    const handleDelete = () => onDelete(backup);
    const getActions = [
        {
            content: (React.createElement("div", { className: styles.dropdownField },
                React.createElement(DBIcon, { type: "restore", "data-testid": "restore-backup-artifact-button", role: "button" }),
                Messages.restoreBackup)),
            disabled: backup.status !== BackupStatus.BACKUP_STATUS_SUCCESS,
            action: handeClick,
        },
        // {
        //   content: (
        //     <div className={styles.dropdownField}>
        //       <DBIcon type="backup" data-testid="add-backup-artifact-button" role="button" />
        //       {Messages.addBackup}
        //     </div>
        //   ),
        //   action: handleBackup,
        // },
        {
            content: (React.createElement("div", { className: styles.dropdownField },
                React.createElement(DBIcon, { type: "delete", "data-testid": "delete-backup-artifact-button", role: "button" }),
                Messages.deleteBackup)),
            disabled: backup.status === BackupStatus.BACKUP_STATUS_IN_PROGRESS ||
                backup.status === BackupStatus.BACKUP_STATUS_PENDING ||
                backup.status === BackupStatus.BACKUP_STATUS_DELETING,
            action: handleDelete,
        },
    ];
    return (React.createElement("div", { className: styles.actionsWrapper },
        React.createElement(Tooltip, { content: Messages.details, placement: "top" },
            React.createElement("span", null,
                React.createElement(ExpandableRowButton, { row: row }))),
        React.createElement(MultipleActions, { actions: getActions, dataTestId: "backup-inventory-actions" })));
};
//# sourceMappingURL=BackupInventoryActions.js.map