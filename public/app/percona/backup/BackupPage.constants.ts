import { PageModel } from 'app/core/components/Breadcrumb';
import { Messages } from './Backup.messages';
import { TabKeys } from './Backup.types';

export const DEFAULT_TAB = TabKeys.locations;

export const PAGE_TABS = [
  {
    title: Messages.tabs.locations,
    id: TabKeys.locations,
    path: `backup/${TabKeys.locations}`,
  },
];

export const PAGE_MODEL: PageModel = {
  title: 'Backups',
  path: 'backup',
  id: 'backup',
  children: PAGE_TABS.map(({ title, id, path }) => ({ title, id, path })),
};
