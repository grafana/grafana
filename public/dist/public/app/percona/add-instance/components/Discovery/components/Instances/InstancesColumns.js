/* eslint-disable react/display-name */
import React from 'react';
import { Button } from '@grafana/ui';
import { DATABASE_LABELS, Databases } from 'app/percona/shared/core';
import { styles } from './Instances.styles';
const getEngineType = (type) => {
    switch (type) {
        case 'DISCOVER_RDS_MYSQL':
            return DATABASE_LABELS[Databases.mysql];
        case 'DISCOVER_RDS_POSTGRESQL':
            return DATABASE_LABELS[Databases.postgresql];
        case 'DISCOVER_RDS_INVALID':
            return 'Unknown type';
        default:
            return 'Unknown type';
    }
};
const getDatabaseType = (type) => {
    switch (type) {
        case 'DISCOVER_RDS_MYSQL':
            return Databases.mysql;
        case 'DISCOVER_RDS_POSTGRESQL':
            return Databases.postgresql;
        default:
            return '';
    }
};
export const getInstancesColumns = (credentials, onSelectInstance) => [
    {
        Header: 'Region',
        accessor: 'region',
    },
    {
        Header: 'Availability Zone',
        accessor: 'az',
    },
    {
        Header: 'Engine',
        accessor: (element) => element.engine ? `${getEngineType(element.engine)}  ${element.engine_version}` : 'nothing',
    },
    {
        Header: 'Instance ID',
        accessor: 'instance_id',
    },
    {
        Header: 'Address',
        accessor: (element) => element.address.split(':')[0],
    },
    {
        Header: 'Action',
        accessor: (element) => {
            const selectionHandler = () => {
                onSelectInstance({
                    type: getDatabaseType(element.engine),
                    credentials: Object.assign(Object.assign({}, Object.assign(Object.assign({}, element), credentials)), { isRDS: true }),
                });
            };
            return (React.createElement("div", { className: styles.actionButtonWrapper },
                React.createElement(Button, { variant: "primary", onClick: selectionHandler }, "Start monitoring")));
        },
    },
];
//# sourceMappingURL=InstancesColumns.js.map