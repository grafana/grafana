import { Messages } from './AddInstance.messages';
import { InstanceTypesExtra } from '../../panel.types';
import { Databases } from 'app/percona/shared/core';

export const instanceList = [
  { type: InstanceTypesExtra.rds, title: Messages.titles.rds },
  { type: Databases.postgresql, title: Messages.titles.postgresql },
  { type: Databases.mysql, title: Messages.titles.mysql },
  { type: Databases.mongodb, title: Messages.titles.mongodb },
  { type: Databases.proxysql, title: Messages.titles.proxysql },
  { type: InstanceTypesExtra.external, title: Messages.titles.external },
  { type: Databases.haproxy, title: Messages.titles.haproxy },
];
