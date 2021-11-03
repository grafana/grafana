import { Button } from '@grafana/ui';
import React from 'react';
import { DATABASE_LABELS, Databases } from 'app/percona/shared/core';
import { styles } from './Instances.styles';
import { Instance } from '../../Discovery.types';
import { Messages } from './Instances.messages';
import { InstanceAvailableType, SelectInstance } from 'app/percona/add-instance/panel.types';
import { AzureCredentialsForm } from '../Credentials/Credentials.types';

const getEngineType = (type?: string) => {
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

const getDatabaseType = (type?: string): InstanceAvailableType => {
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

export const getInstancesColumns = (credentials: AzureCredentialsForm, onSelectInstance: SelectInstance) => [
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
    accessor: (element: Instance) => (element.type ? `${getEngineType(element.type)}` : Messages.notAvailableType),
  },
  {
    Header: 'Address',
    accessor: 'address',
  },
  {
    Header: 'Action',
    accessor: (element: Instance) => {
      const selectionHandler = () => {
        onSelectInstance({
          type: getDatabaseType(element.type),
          credentials: { ...{ ...element, ...credentials }, isAzure: true },
        });
      };

      return (
        <div className={styles.actionButtonWrapper}>
          <Button variant="primary" onClick={selectionHandler}>
            Start monitoring
          </Button>
        </div>
      );
    },
  },
];
