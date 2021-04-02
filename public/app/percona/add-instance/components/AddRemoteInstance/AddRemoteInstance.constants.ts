import { InstanceTypes } from '../../panel.types';

export const DEFAULT_PORTS = {
  [InstanceTypes.mysql]: '3306',
  [InstanceTypes.mongodb]: '27017',
  [InstanceTypes.postgresql]: '5432',
  [InstanceTypes.proxysql]: '6032',
  [InstanceTypes.haproxy]: '8404',
};
