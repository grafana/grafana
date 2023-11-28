import { Databases } from 'app/percona/shared/core';
export const DEFAULT_PORTS = {
    [Databases.mysql]: '3306',
    [Databases.mongodb]: '27017',
    [Databases.postgresql]: '5432',
    [Databases.proxysql]: '6032',
    [Databases.haproxy]: '8404',
};
export const ADD_RDS_CANCEL_TOKEN = 'addRds';
export const ADD_AZURE_CANCEL_TOKEN = 'addAzure';
//# sourceMappingURL=AddRemoteInstance.constants.js.map