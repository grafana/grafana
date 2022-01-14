import { PageModel } from 'app/core/components/Breadcrumb';
import { Messages } from './IntegratedAlerting.messages';
import { TabKeys } from './IntegratedAlerting.types';

export const DEFAULT_TAB = TabKeys.alerts;

export const PAGE_TABS = [
  {
    title: Messages.tabs.alerts,
    id: TabKeys.alerts,
    path: `integrated-alerting/${TabKeys.alerts}`,
  },
  {
    title: Messages.tabs.alertRules,
    id: TabKeys.alertRules,
    path: `integrated-alerting/${TabKeys.alertRules}`,
  },
  {
    title: Messages.tabs.alertRuleTemplates,
    id: TabKeys.alertRuleTemplates,
    path: `integrated-alerting/${TabKeys.alertRuleTemplates}`,
  },
  {
    title: Messages.tabs.notificationChannels,
    id: TabKeys.notificationChannels,
    path: `integrated-alerting/${TabKeys.notificationChannels}`,
  },
];

export const PAGE_MODEL: PageModel = {
  title: 'Integrated Alerting',
  path: 'integrated-alerting',
  id: 'integrated-alerting',
  children: PAGE_TABS.map(({ title, id, path }) => ({ title, id, path })),
};
