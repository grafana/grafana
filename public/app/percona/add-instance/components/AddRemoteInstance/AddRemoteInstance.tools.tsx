/* eslint-disable @typescript-eslint/no-explicit-any */
import { Databases } from 'app/percona/shared/core';
import { logger } from 'app/percona/shared/helpers/logger';

import { InstanceAvailableType, INSTANCE_TYPES_LABELS } from '../../panel.types';
import { DiscoverAzureDatabaseType, DiscoverRDSEngine } from '../Discovery/Discovery.types';

import { DEFAULT_PORTS } from './AddRemoteInstance.constants';
import { InstanceData } from './AddRemoteInstance.types';
import { MetricsParameters, Schema } from './FormParts/FormParts.types';

const getAzureCredentials = (credentials: any, instanceType: string) => {
  const instance: InstanceData = {
    remoteInstanceCredentials: {
      serviceName: credentials.address,
      port: credentials.port,
      username: credentials.username,
      address: credentials.address,
      isAzure: true,
      region: credentials.region,
      azure_client_id: credentials.azure_client_id,
      azure_client_secret: credentials.azure_client_secret,
      azure_tenant_id: credentials.azure_tenant_id,
      azure_subscription_id: credentials.azure_subscription_id,
      azure_resource_group: credentials.azure_resource_group,
      instance_id: credentials.instance_id,
      az: credentials.az,
      azure_database_exporter: true,
    },
  };

  switch (instanceType) {
    case Databases.postgresql:
      instance.instanceType = INSTANCE_TYPES_LABELS[Databases.postgresql];
      instance.discoverName = DiscoverAzureDatabaseType.POSTGRESQL;
      instance.remoteInstanceCredentials.port =
        instance.remoteInstanceCredentials.port || DEFAULT_PORTS[Databases.postgresql];
      break;
    case Databases.mysql:
      instance.instanceType = INSTANCE_TYPES_LABELS[Databases.mysql];
      instance.discoverName = DiscoverAzureDatabaseType.MYSQL;
      instance.remoteInstanceCredentials.port =
        instance.remoteInstanceCredentials.port || DEFAULT_PORTS[Databases.mysql];
      break;
    case Databases.mariadb:
      instance.instanceType = INSTANCE_TYPES_LABELS[Databases.mariadb];
      instance.discoverName = DiscoverAzureDatabaseType.MARIADB;
      instance.remoteInstanceCredentials.port =
        instance.remoteInstanceCredentials.port || DEFAULT_PORTS[Databases.mysql];
      break;
    default:
      logger.error('Not implemented');
  }

  return instance;
};

const getRDSCredentials = (credentials: any, instanceType: InstanceAvailableType): InstanceData => {
  const instance: InstanceData = {
    remoteInstanceCredentials: {
      serviceName: !credentials.isRDS ? credentials.address : credentials.instance_id,
      port: credentials.port,
      address: credentials.address,
      isRDS: true,
      region: credentials.region,
      aws_access_key: credentials.aws_access_key,
      aws_secret_key: credentials.aws_secret_key,
      instance_id: credentials.instance_id,
      az: credentials.az,
    },
  };

  switch (instanceType) {
    case Databases.postgresql:
      instance.instanceType = INSTANCE_TYPES_LABELS[Databases.postgresql];
      instance.discoverName = DiscoverRDSEngine.POSTGRESQL;
      instance.remoteInstanceCredentials.port =
        instance.remoteInstanceCredentials.port || DEFAULT_PORTS[Databases.postgresql];
      break;
    case Databases.mysql:
      instance.instanceType = INSTANCE_TYPES_LABELS[Databases.mysql];
      instance.discoverName = DiscoverRDSEngine.MYSQL;
      instance.remoteInstanceCredentials.port =
        instance.remoteInstanceCredentials.port || DEFAULT_PORTS[Databases.mysql];
      break;
    case Databases.mongodb:
      instance.instanceType = INSTANCE_TYPES_LABELS[Databases.mongodb];
      instance.remoteInstanceCredentials.port =
        instance.remoteInstanceCredentials.port || DEFAULT_PORTS[Databases.mongodb];
      break;
    case Databases.proxysql:
      instance.instanceType = INSTANCE_TYPES_LABELS[Databases.proxysql];
      instance.remoteInstanceCredentials.port =
        instance.remoteInstanceCredentials.port || DEFAULT_PORTS[Databases.proxysql];
      break;
    case Databases.haproxy:
      instance.instanceType = INSTANCE_TYPES_LABELS[Databases.haproxy];
      instance.remoteInstanceCredentials.port =
        instance.remoteInstanceCredentials.port || DEFAULT_PORTS[Databases.haproxy];
      break;
    default:
      logger.error('Not implemented');
  }

  return instance;
};

export const getInstanceData = (instanceType: InstanceAvailableType, credentials: any): InstanceData => {
  const extractCredentials = (credentials?: any): InstanceData => {
    if (credentials?.isRDS) {
      return getRDSCredentials(credentials, instanceType);
    } else if (credentials?.isAzure) {
      return getAzureCredentials(credentials, instanceType);
    }

    const instance: any = {
      remoteInstanceCredentials: {
        metricsParameters: MetricsParameters.manually,
        schema: Schema.HTTPS,
        pmm_agent_id: '',
      },
    };

    switch (instanceType) {
      case Databases.postgresql:
        instance.instanceType = INSTANCE_TYPES_LABELS[Databases.postgresql];
        instance.remoteInstanceCredentials.port = DEFAULT_PORTS[Databases.postgresql];
        break;
      case Databases.mysql:
        instance.instanceType = INSTANCE_TYPES_LABELS[Databases.mysql];
        instance.remoteInstanceCredentials.port = DEFAULT_PORTS[Databases.mysql];
        break;
      case Databases.mongodb:
        instance.instanceType = INSTANCE_TYPES_LABELS[Databases.mongodb];
        instance.remoteInstanceCredentials.port = DEFAULT_PORTS[Databases.mongodb];
        break;
      case Databases.proxysql:
        instance.instanceType = INSTANCE_TYPES_LABELS[Databases.proxysql];
        instance.remoteInstanceCredentials.port = DEFAULT_PORTS[Databases.proxysql];
        break;
      case Databases.haproxy:
        instance.instanceType = INSTANCE_TYPES_LABELS[Databases.haproxy];
        instance.remoteInstanceCredentials.port = DEFAULT_PORTS[Databases.haproxy];
        break;
      default:
        logger.error('Not implemented');
    }
    return instance;
  };

  return extractCredentials(credentials);
};

export const remoteToken = (type: string) => `${type}Token`;
