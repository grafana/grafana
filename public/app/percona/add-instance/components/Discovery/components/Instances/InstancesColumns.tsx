/* eslint-disable react/display-name */
import React from 'react';

import { Button } from '@grafana/ui';
import { SelectInstance } from 'app/percona/add-instance/panel.types';
import { DATABASE_LABELS, Databases } from 'app/percona/shared/core';

import { DiscoverRDSEngine, Instance } from '../../Discovery.types';
import { RDSCredentialsForm } from '../Credentials/Credentials.types';

import { styles } from './Instances.styles';

const getEngineType = (type?: string) => {
  switch (type) {
    case DiscoverRDSEngine.MYSQL:
      return DATABASE_LABELS[Databases.mysql];
    case DiscoverRDSEngine.POSTGRESQL:
      return DATABASE_LABELS[Databases.postgresql];
    case DiscoverRDSEngine.UNSPECIFIED:
      return 'Unknown type';
    default:
      return 'Unknown type';
  }
};

const getDatabaseType = (type?: string) => {
  switch (type) {
    case DiscoverRDSEngine.MYSQL:
      return Databases.mysql;
    case DiscoverRDSEngine.POSTGRESQL:
      return Databases.postgresql;
    default:
      return '';
  }
};

export const getInstancesColumns = (credentials: RDSCredentialsForm, onSelectInstance: SelectInstance) => [
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
    accessor: (element: Instance) =>
      element.engine ? `${getEngineType(element.engine)}  ${element.engine_version}` : 'nothing',
  },
  {
    Header: 'Instance ID',
    accessor: 'instance_id',
  },
  {
    Header: 'Address',
    accessor: (element: Instance) => element.address.split(':')[0],
  },
  {
    Header: 'Action',
    accessor: (element: Instance) => {
      const selectionHandler = () => {
        onSelectInstance({
          type: getDatabaseType(element.engine),
          credentials: { ...{ ...element, ...credentials }, isRDS: true },
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
