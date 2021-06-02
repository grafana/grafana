import { Messages as AddInstanceMessages } from './components/AddInstance/AddInstance.messages';
import { InstanceTypes } from './panel.types';
import { PageModel } from '../../core/components/Breadcrumb';

export const PAGE_TABS = [
  {
    title: AddInstanceMessages.titles.rds,
    id: InstanceTypes.rds,
    path: `add-instance/${InstanceTypes.rds}`,
  },
  {
    title: AddInstanceMessages.titles.postgresql,
    id: InstanceTypes.postgresql,
    path: `add-instance/${InstanceTypes.postgresql}`,
  },
  {
    title: AddInstanceMessages.titles.mysql,
    id: InstanceTypes.mysql,
    path: `add-instance/${InstanceTypes.mysql}`,
  },
  {
    title: AddInstanceMessages.titles.mongodb,
    id: InstanceTypes.mongodb,
    path: `add-instance/${InstanceTypes.mongodb}`,
  },
  {
    title: AddInstanceMessages.titles.proxysql,
    id: InstanceTypes.proxysql,
    path: `add-instance/${InstanceTypes.proxysql}`,
  },
  {
    title: AddInstanceMessages.titles.external,
    id: InstanceTypes.external,
    path: `add-instance/${InstanceTypes.external}`,
  },
  {
    title: AddInstanceMessages.titles.haproxy,
    id: InstanceTypes.haproxy,
    path: `add-instance/${InstanceTypes.haproxy}`,
  },
];

export const PAGE_MODEL: PageModel = {
  title: 'Add Instance',
  path: 'add-instance',
  id: 'add-instance',
  children: PAGE_TABS.map(({ title, id, path }) => ({ title, id, path })),
};
