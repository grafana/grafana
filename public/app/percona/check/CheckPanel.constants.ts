import { Failed } from './components';
import { CheckPanelOptions, Column, SeverityMap, TabKeys } from './types';
import { Messages } from './CheckPanel.messages';
import { PageModel } from '../../core/components/Breadcrumb';

export const PMM_SETTINGS_URL = '/graph/settings/advanced-settings';

export const DEFAULTS: CheckPanelOptions = {
  title: 'Failed Database Checks',
};

export const SEVERITIES_ORDER = {
  error: 0,
  warning: 1,
  notice: 2,
};

export const SEVERITY: SeverityMap = {
  error: 'Critical',
  warning: 'Major',
  notice: 'Trivial',
};

export const COLUMNS: Column[] = [
  {
    title: 'Service name',
    dataIndex: 'name',
    key: 'name',
  },
  {
    title: 'Failed Checks',
    dataIndex: 'failed',
    key: 'failed',
    render: Failed,
    width: 200,
  },
  {
    title: 'Severity',
    dataIndex: 'severity',
    key: 'severity',
  },
  {
    title: 'Details',
    dataIndex: 'details',
    key: 'details',
  },
  {
    title: 'Actions',
    dataIndex: 'actions',
    key: 'actions',
  },
];

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
