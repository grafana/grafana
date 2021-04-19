import { PageModel } from 'app/core/components/Breadcrumb';
import { Messages } from './Settings.messages';
import { TabKeys } from './Settings.types';

export const GET_SETTINGS_CANCEL_TOKEN = 'getSettings';
export const SET_SETTINGS_CANCEL_TOKEN = 'setSettings';

export const DEFAULT_TAB = TabKeys.metrics;

export const PAGE_TABS = [
  {
    title: Messages.tabs.metrics,
    id: TabKeys.metrics,
    path: `settings/${TabKeys.metrics}`,
  },
  {
    title: Messages.tabs.advanced,
    id: TabKeys.advanced,
    path: `settings/${TabKeys.advanced}`,
  },
  {
    title: Messages.tabs.ssh,
    id: TabKeys.ssh,
    path: `settings/${TabKeys.ssh}`,
  },
  {
    title: Messages.tabs.alertManager,
    id: TabKeys.alertManager,
    path: `settings/${TabKeys.alertManager}`,
  },
  {
    title: Messages.tabs.perconaPlatform,
    id: TabKeys.perconaPlatform,
    path: `settings/${TabKeys.perconaPlatform}`,
  },
  {
    title: Messages.tabs.communication,
    id: TabKeys.communication,
    path: `settings/${TabKeys.communication}`,
  },
];

export const PAGE_MODEL: PageModel = {
  title: 'Settings',
  path: 'settings',
  id: 'settings',
  children: PAGE_TABS.map(({ title, id, path }) => ({ title, id, path })),
};
