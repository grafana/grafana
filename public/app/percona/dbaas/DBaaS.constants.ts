import { Messages } from './DBaaS.messages';
import { TabKeys } from './DBaaS.types';
import { PageModel } from '../../core/components/Breadcrumb';

export const DEFAULT_TAB = TabKeys.kubernetes;

export const PAGE_TABS = [
  {
    title: Messages.tabs.kubernetes,
    id: TabKeys.kubernetes,
    path: `dbaas/${TabKeys.kubernetes}`,
  },
  {
    title: Messages.tabs.dbcluster,
    id: TabKeys.dbclusters,
    path: `dbaas/${TabKeys.dbclusters}`,
  },
];

export const PAGE_MODEL: PageModel = {
  title: 'DBaaS',
  path: 'dbaas',
  id: 'dbaas',
  children: PAGE_TABS.map(({ title, id, path }) => ({ title, id, path })),
};
