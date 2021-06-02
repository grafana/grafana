import { InstanceData } from './AddRemoteInstance.types';
import { INSTANCE_TYPES_LABELS, InstanceTypes } from '../../panel.types';

export const getInstanceData = (instanceType: string, credentials: any): InstanceData => {
  const extractCredentials = (credentials?: any): InstanceData => {
    if (!credentials) {
      return { remoteInstanceCredentials: {} };
    }

    return {
      remoteInstanceCredentials: {
        serviceName: !credentials.isRDS ? credentials.address : credentials.instance_id,
        port: credentials.port,
        address: credentials.address,
        isRDS: credentials.isRDS,
        region: credentials.region,
        aws_access_key: credentials.aws_access_key,
        aws_secret_key: credentials.aws_secret_key,
        instance_id: credentials.instance_id,
        az: credentials.az,
      },
    };
  };

  const instance = extractCredentials(credentials);

  switch (instanceType) {
    case InstanceTypes.postgresql:
      instance.instanceType = INSTANCE_TYPES_LABELS[InstanceTypes.postgresql];
      instance.discoverName = 'DISCOVER_RDS_POSTGRESQL';
      instance.remoteInstanceCredentials.port = instance.remoteInstanceCredentials.port || 5432;
      break;
    case InstanceTypes.mysql:
      instance.instanceType = INSTANCE_TYPES_LABELS[InstanceTypes.mysql];
      instance.discoverName = 'DISCOVER_RDS_MYSQL';
      instance.remoteInstanceCredentials.port = instance.remoteInstanceCredentials.port || 3306;
      break;
    case InstanceTypes.mongodb:
      instance.instanceType = INSTANCE_TYPES_LABELS[InstanceTypes.mongodb];
      instance.remoteInstanceCredentials.port = instance.remoteInstanceCredentials.port || 27017;
      break;
    case InstanceTypes.proxysql:
      instance.instanceType = INSTANCE_TYPES_LABELS[InstanceTypes.proxysql];
      instance.remoteInstanceCredentials.port = instance.remoteInstanceCredentials.port || 6032;
      break;
    case InstanceTypes.haproxy:
      instance.instanceType = INSTANCE_TYPES_LABELS[InstanceTypes.haproxy];
      instance.remoteInstanceCredentials.port = instance.remoteInstanceCredentials.port || 8404;
      break;
    default:
      console.error('Not implemented');
  }

  return instance;
};
