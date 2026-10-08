import { t } from '@grafana/i18n';
import { type BadgeColor } from '@grafana/ui';
import { type PageHistoryKind } from 'app/core/services/pageHistory/types';

/** Every kind, in the order the filter and the rows present them. */
export const PAGE_KINDS: readonly PageHistoryKind[] = ['dashboard', 'explore', 'alerting', 'app'];

export type PageKindCounts = Record<PageHistoryKind, number>;

export function countByKind(items: ReadonlyArray<{ kind: PageHistoryKind }>): PageKindCounts {
  const counts: PageKindCounts = { dashboard: 0, explore: 0, alerting: 0, app: 0 };
  for (const { kind } of items) {
    counts[kind]++;
  }
  return counts;
}

interface PageKindMeta {
  /** Plural, for the kind filter. */
  filterLabel: string;
  /** Singular, for the row badge. */
  badge: string;
  color: BadgeColor;
}

export function getPageKindMeta(kind: PageHistoryKind): PageKindMeta {
  switch (kind) {
    case 'dashboard':
      return {
        filterLabel: t('home.recent-activity-tab.filter-dashboards', 'Dashboards'),
        badge: t('home.recent-activity-tab.kind-dashboard', 'Dashboard'),
        color: 'blue',
      };
    case 'explore':
      return {
        filterLabel: t('home.recent-activity-tab.filter-explore', 'Explore'),
        badge: t('home.recent-activity-tab.kind-explore', 'Explore'),
        color: 'orange',
      };
    case 'alerting':
      return {
        filterLabel: t('home.recent-activity-tab.filter-alerting', 'Alerting'),
        badge: t('home.recent-activity-tab.kind-alerting', 'Alerting'),
        color: 'red',
      };
    case 'app':
      return {
        filterLabel: t('home.recent-activity-tab.filter-apps', 'Apps'),
        badge: t('home.recent-activity-tab.kind-app', 'App'),
        color: 'purple',
      };
  }
}
