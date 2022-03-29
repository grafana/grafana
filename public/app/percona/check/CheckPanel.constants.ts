import { TabKeys } from './types';
import { Messages } from './CheckPanel.messages';
import { PageModel } from '../../core/components/Breadcrumb';

export const PMM_SETTINGS_URL = '/graph/settings/advanced-settings';

export const DEFAULT_TAB = TabKeys.failedChecks;

export const PAGE_TABS = [
  {
    title: Messages.failedChecksTitle,
    id: TabKeys.failedChecks,
    path: `pmm-database-checks/${TabKeys.failedChecks}`,
  },
  {
    title: Messages.allChecksTitle,
    id: TabKeys.allChecks,
    path: `pmm-database-checks/${TabKeys.allChecks}`,
  },
];

export const PAGE_MODEL: PageModel = {
  title: Messages.pageTitle,
  path: 'pmm-database-checks',
  id: TabKeys.rootChecks,
  children: PAGE_TABS.map(({ title, id, path }) => ({ title, id, path })),
};

export const GET_SETTINGS_TOKEN = 'getSettings';
