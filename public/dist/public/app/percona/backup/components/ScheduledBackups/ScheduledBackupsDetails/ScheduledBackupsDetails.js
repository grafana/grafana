import React from 'react';
import { useStyles } from '@grafana/ui';
import { formatDataModel } from 'app/percona/backup/Backup.utils';
import { DescriptionBlock } from '../../DescriptionBlock';
import { Messages } from './ScheduledBackupsDetails.messages';
import { getStyles } from './ScheduledBackupsDetails.styles';
export const ScheduledBackupDetails = ({ name, description, dataModel, cronExpression, folder, }) => {
    const styles = useStyles(getStyles);
    const dataModelMsg = formatDataModel(dataModel);
    return (React.createElement("div", { className: styles.detailsWrapper, "data-testid": "scheduled-backup-details-wrapper" },
        React.createElement("span", { "data-testid": "scheduled-backup-details-name" },
            React.createElement("span", { className: styles.detailLabel }, Messages.backupName),
            " ",
            React.createElement("span", null, name)),
        !!description && (React.createElement(DescriptionBlock, { description: description, dataTestId: "scheduled-backup-details-description" })),
        React.createElement("span", { "data-testid": "scheduled-backup-details-data-model" },
            React.createElement("span", { className: styles.detailLabel }, Messages.dataModel),
            " ",
            React.createElement("span", null, dataModelMsg)),
        React.createElement("span", { "data-testid": "scheduled-backup-details-cron" },
            React.createElement("span", { className: styles.detailLabel }, Messages.cronExpression),
            " ",
            React.createElement("span", null, cronExpression)),
        folder && (React.createElement("span", { "data-testid": "scheduled-backup-details-folder" },
            React.createElement("span", { className: styles.detailLabel }, Messages.folder),
            " ",
            React.createElement("span", null, folder)))));
};
//# sourceMappingURL=ScheduledBackupsDetails.js.map