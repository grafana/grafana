/* eslint-disable react/display-name */
import React from 'react';
import { Button } from '@grafana/ui';
import { DATABASE_LABELS, Databases } from 'app/percona/shared/core';
import { Messages } from './Instances.messages';
import { styles } from './Instances.styles';
const getEngineType = (type) => {
    switch (type) {
        case 'DISCOVER_AZURE_DATABASE_TYPE_MYSQL':
            return DATABASE_LABELS[Databases.mysql];
        case 'DISCOVER_AZURE_DATABASE_TYPE_MARIADB':
            return DATABASE_LABELS[Databases.mariadb];
        case 'DISCOVER_AZURE_DATABASE_TYPE_POSTGRESQL':
            return DATABASE_LABELS[Databases.postgresql];
        case 'DISCOVER_AZURE_DATABASE_INVALID':
            return 'Unknown type';
        default:
            return 'Unknown type';
    }
};
const getDatabaseType = (type) => {
    switch (type) {
        case 'DISCOVER_AZURE_DATABASE_TYPE_MYSQL':
        case 'DISCOVER_AZURE_DATABASE_TYPE_MARIADB':
            return Databases.mysql;
        case 'DISCOVER_AZURE_DATABASE_TYPE_POSTGRESQL':
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
        Header: 'Resource group',
        accessor: 'azure_resource_group',
    },
    {
        Header: 'Name',
        accessor: 'service_name',
    },
    {
        Header: 'Engine',
        accessor: (element) => (element.type ? `${getEngineType(element.type)}` : Messages.notAvailableType),
    },
    {
        Header: 'Address',
        accessor: 'address',
    },
    {
        Header: 'Action',
        accessor: (element) => {
            const selectionHandler = () => {
                onSelectInstance({
                    type: getDatabaseType(element.type),
                    credentials: Object.assign(Object.assign({}, Object.assign(Object.assign({}, element), credentials)), { isAzure: true }),
                });
            };
            return (React.createElement("div", { className: styles.actionButtonWrapper },
                React.createElement(Button, { variant: "primary", onClick: selectionHandler }, "Start monitoring")));
        },
    },
];
//# sourceMappingURL=InstancesColumns.js.map