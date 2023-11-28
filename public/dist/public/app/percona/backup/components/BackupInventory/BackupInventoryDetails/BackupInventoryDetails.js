import React from 'react';
import { useStyles } from '@grafana/ui';
import { formatDataModel } from 'app/percona/backup/Backup.utils';
import { Messages } from './BackupInventoryDetails.messages';
import { getStyles } from './BackupInventoryDetails.styles';
export const BackupInventoryDetails = ({ name, folder, dataModel }) => {
    const styles = useStyles(getStyles);
    const dataModelMsg = formatDataModel(dataModel);
    return (React.createElement("div", { className: styles.detailsWrapper, "data-testid": "backup-artifact-details-wrapper" },
        React.createElement("span", { "data-testid": "backup-artifact-details-name" },
            React.createElement("span", { className: styles.detailLabel }, Messages.backupName),
            " ",
            React.createElement("span", null, name)),
        React.createElement("span", { "data-testid": "backup-artifact-details-data-model" },
            React.createElement("span", { className: styles.detailLabel }, Messages.dataModel),
            " ",
            React.createElement("span", null, dataModelMsg)),
        folder && (React.createElement("span", { "data-testid": "backup-artifact-details-folder" },
            React.createElement("span", { className: styles.detailLabel }, Messages.folder),
            " ",
            React.createElement("span", null, folder)))));
};
//# sourceMappingURL=BackupInventoryDetails.js.map