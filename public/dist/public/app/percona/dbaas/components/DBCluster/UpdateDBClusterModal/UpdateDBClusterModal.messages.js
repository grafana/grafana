/* eslint-disable react/display-name */
import React from 'react';
import { DATABASE_LABELS } from 'app/percona/shared/core/constants';
export const Messages = {
    cancel: 'Cancel',
    confirm: 'Update',
    title: 'Confirm database update',
    buildUpdateDatabaseMessage: (databaseType, installedVersion, availableVersion, clusterName) => (React.createElement(React.Fragment, null,
        "Are you sure you want to update ",
        DATABASE_LABELS[databaseType],
        " ",
        installedVersion,
        " to version ",
        availableVersion,
        ' ',
        "in ",
        clusterName,
        " cluster?")),
};
//# sourceMappingURL=UpdateDBClusterModal.messages.js.map