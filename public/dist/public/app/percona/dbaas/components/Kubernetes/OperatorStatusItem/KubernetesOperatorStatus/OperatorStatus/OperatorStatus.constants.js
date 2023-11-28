import { Databases } from 'app/percona/shared/core';
import { KubernetesOperatorStatus } from '../KubernetesOperatorStatus.types';
export const OPERATORS_DOCS_URL = {
    [Databases.mysql]: 'https://per.co.na/x0wBC4',
    [Databases.mongodb]: 'https://per.co.na/03Clok',
    [Databases.postgresql]: '',
    [Databases.proxysql]: '',
    [Databases.mariadb]: '',
    [Databases.haproxy]: '',
};
export const VERSION_PLACEHOLDER = '<version>';
export const OPERATORS_RN_URL = {
    [Databases.mysql]: `https://www.percona.com/doc/kubernetes-operator-for-pxc/ReleaseNotes/Kubernetes-Operator-for-PXC-RN${VERSION_PLACEHOLDER}.html`,
    [Databases.mongodb]: `https://www.percona.com/doc/kubernetes-operator-for-psmongodb/RN/Kubernetes-Operator-for-PSMONGODB-RN${VERSION_PLACEHOLDER}.html`,
    [Databases.postgresql]: '',
    [Databases.proxysql]: '',
    [Databases.mariadb]: '',
    [Databases.haproxy]: '',
};
export const STATUS_DATA_QA = {
    [KubernetesOperatorStatus.invalid]: 'invalid',
    [KubernetesOperatorStatus.ok]: 'ok',
    [KubernetesOperatorStatus.unsupported]: 'unsupported',
    [KubernetesOperatorStatus.unavailable]: 'unavailable',
};
//# sourceMappingURL=OperatorStatus.constants.js.map