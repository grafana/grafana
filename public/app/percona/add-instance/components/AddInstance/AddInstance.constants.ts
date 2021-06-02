import { Messages } from './AddInstance.messages';
import { InstanceTypes } from '../../panel.types';

export const instanceList = [
  { type: InstanceTypes.rds, title: Messages.titles.rds },
  { type: InstanceTypes.postgresql, title: Messages.titles.postgresql },
  { type: InstanceTypes.mysql, title: Messages.titles.mysql },
  { type: InstanceTypes.mongodb, title: Messages.titles.mongodb },
  { type: InstanceTypes.proxysql, title: Messages.titles.proxysql },
  { type: InstanceTypes.external, title: Messages.titles.external },
  { type: InstanceTypes.haproxy, title: Messages.titles.haproxy },
];
