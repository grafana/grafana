import { PageModel } from 'app/core/components/Breadcrumb';
import { Messages } from './Backup.messages';
import { TabKeys } from './Backup.types';

export const DEFAULT_TAB = TabKeys.inventory;

export const PAGE_TABS = [
  {
    title: Messages.tabs.inventory,
    id: TabKeys.inventory,
    path: `backup/${TabKeys.inventory}`,
  },
  {
    title: Messages.tabs.restore,
    id: TabKeys.restore,
    path: `backup/${TabKeys.restore}`,
  },
  {
    title: Messages.tabs.locations,
    id: TabKeys.locations,
    path: `backup/${TabKeys.locations}`,
  },
];

export const PAGE_MODEL: PageModel = {
  title: 'Backup Management',
  path: 'backup',
  id: 'backup',
  children: PAGE_TABS.map(({ title, id, path }) => ({ title, id, path })),
};
