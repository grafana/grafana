/* eslint-disable react/display-name */
import React from 'react';

import { Button } from '@grafana/ui';
import { InstanceAvailableType, SelectInstance } from 'app/percona/add-instance/panel.types';
import { DATABASE_LABELS, Databases } from 'app/percona/shared/core';

import { DiscoverAzureDatabaseType } from '../../../Discovery/Discovery.types';
import { Instance } from '../../Discovery.types';
import { AzureCredentialsForm } from '../Credentials/Credentials.types';

import { Messages } from './Instances.messages';
import { styles } from './Instances.styles';

const getEngineType = (type?: string) => {
  switch (type) {
    case DiscoverAzureDatabaseType.MYSQL:
      return DATABASE_LABELS[Databases.mysql];
    case DiscoverAzureDatabaseType.MARIADB:
      return DATABASE_LABELS[Databases.mariadb];
    case DiscoverAzureDatabaseType.POSTGRESQL:
      return DATABASE_LABELS[Databases.postgresql];
    case DiscoverAzureDatabaseType.INVALID:
      return 'Unknown type';
    default:
      return 'Unknown type';
  }
};

const getDatabaseType = (type?: string): InstanceAvailableType => {
  switch (type) {
    case DiscoverAzureDatabaseType.MYSQL:
    case DiscoverAzureDatabaseType.MARIADB:
      return Databases.mysql;
    case DiscoverAzureDatabaseType.POSTGRESQL:
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
