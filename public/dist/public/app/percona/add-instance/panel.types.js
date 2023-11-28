import { Databases } from '../../percona/shared/core';
export var InstanceTypesExtra;
(function (InstanceTypesExtra) {
    InstanceTypesExtra["rds"] = "rds";
    InstanceTypesExtra["azure"] = "azure";
    InstanceTypesExtra["external"] = "external";
})(InstanceTypesExtra || (InstanceTypesExtra = {}));
export const INSTANCE_TYPES_LABELS = {
    [Databases.mysql]: 'MySQL',
    [Databases.mariadb]: 'MariaDB',
    [Databases.mongodb]: 'MongoDB',
    [Databases.postgresql]: 'PostgreSQL',
    [Databases.proxysql]: 'ProxySQL',
    [Databases.haproxy]: 'HAProxy',
    [InstanceTypesExtra.azure]: '',
    [InstanceTypesExtra.rds]: '',
    [InstanceTypesExtra.external]: '',
};
//# sourceMappingURL=panel.types.js.map