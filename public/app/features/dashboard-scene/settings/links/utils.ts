import { IconName } from '@grafana/data';
import { DashboardLink } from '@grafana/schema';

export const NEW_LINK: DashboardLink = {
  icon: 'external link',
  title: 'New link',
  tooltip: '',
  type: 'dashboards',
  url: '',
  asDropdown: false,
  tags: [],
  targetBlank: false,
  keepTime: false,
  includeVars: false,
};

export const LINK_ICON_MAP: Record<string, IconName | undefined> = {
  'external link': 'external-link-alt',
  dashboard: 'apps',
  question: 'question-circle',
  info: 'info-circle',
  bolt: 'bolt',
  doc: 'file-alt',
  cloud: 'cloud',
};
