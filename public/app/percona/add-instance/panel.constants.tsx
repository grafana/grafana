import { Messages as AddInstanceMessages } from './components/AddInstance/AddInstance.messages';
import { InstanceTypesExtra } from './panel.types';
import { PageModel } from '../../core/components/Breadcrumb';
import { Databases } from '../../percona/shared/core';

export const PAGE_TABS = [
  {
    title: AddInstanceMessages.titles.rds,
    id: InstanceTypesExtra.rds,
    path: `add-instance/${InstanceTypesExtra.rds}`,
  },
  {
    title: AddInstanceMessages.titles.postgresql,
    id: Databases.postgresql,
    path: `add-instance/${Databases.postgresql}`,
  },
  {
    title: AddInstanceMessages.titles.mysql,
    id: Databases.mysql,
    path: `add-instance/${Databases.mysql}`,
  },
  {
    title: AddInstanceMessages.titles.mongodb,
    id: Databases.mongodb,
    path: `add-instance/${Databases.mongodb}`,
  },
  {
    title: AddInstanceMessages.titles.proxysql,
    id: Databases.proxysql,
    path: `add-instance/${Databases.proxysql}`,
  },
  {
    title: AddInstanceMessages.titles.external,
    id: InstanceTypesExtra.external,
    path: `add-instance/${InstanceTypesExtra.external}`,
  },
  {
    title: AddInstanceMessages.titles.haproxy,
    id: Databases.haproxy,
    path: `add-instance/${Databases.haproxy}`,
  },
];

export const PAGE_MODEL: PageModel = {
  title: 'Add Instance',
  path: 'add-instance',
  id: 'add-instance',
  children: PAGE_TABS.map(({ title, id, path }) => ({ title, id, path })),
};
