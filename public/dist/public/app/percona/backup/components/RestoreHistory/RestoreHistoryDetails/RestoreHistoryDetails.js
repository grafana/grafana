import React from 'react';
import { useStyles } from '@grafana/ui';
import { formatDataModel } from 'app/percona/backup/Backup.utils';
import { DetailedDate } from '../../DetailedDate';
import { Messages } from './RestoreHistoryDetails.Messages';
import { getStyles } from './RestoreHistoryDetails.styles';
export const RestoreHistoryDetails = ({ name, dataModel, pitrTimestamp }) => {
    const styles = useStyles(getStyles);
    const dataModelMsg = formatDataModel(dataModel);
    return (React.createElement("div", { className: styles.detailsWrapper, "data-testid": "restore-details-wrapper" },
        React.createElement("span", { "data-testid": "restore-details-name" },
            React.createElement("span", { className: styles.detailLabel }, Messages.backupName),
            " ",
            React.createElement("span", null, name)),
        React.createElement("span", { "data-testid": "restore-details-data-model" },
            React.createElement("span", { className: styles.detailLabel }, Messages.dataModel),
            " ",
            React.createElement("span", null, dataModelMsg)),
        pitrTimestamp ? (React.createElement("span", { className: styles.pitrContainer, "data-testid": "restore-details-pitr" },
            React.createElement("span", { className: styles.detailLabel }, Messages.pitr),
            React.createElement(DetailedDate, { date: pitrTimestamp, dataTestId: "restore-details-date" }))) : null));
};
//# sourceMappingURL=RestoreHistoryDetails.js.map