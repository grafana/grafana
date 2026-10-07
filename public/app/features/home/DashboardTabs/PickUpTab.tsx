import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useFlagGrafanaGrowthHomepage } from '@grafana/runtime/internal';
import { Badge, type BadgeColor, Stack, useStyles2 } from '@grafana/ui';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { type PageHistoryKind } from 'app/core/services/pageHistory/types';
import { type LocationInfo } from 'app/features/search/service/types';
import { ListRow } from 'app/plugins/panel/dashlist/ListRow';

import { SummaryCardAge } from '../AlertsIncidents/SummaryCard';
import { ctaClicked } from '../analytics/main';

import { DashboardTabEmptyState } from './DashboardTabEmptyState';
import { DashboardTabError } from './DashboardTabError';
import { type PickUpItem } from './getPickUpItems';

interface Props {
  items: PickUpItem[];
  loading: boolean;
  error: Error | undefined;
  retry: () => void;
  foldersByUid: Record<string, LocationInfo>;
  density?: 'default' | 'compact'; // 'compact' is only used in the homepage redesign
}

const KIND_COLOR: Record<PageHistoryKind, BadgeColor> = {
  dashboard: 'blue',
  explore: 'orange',
  investigation: 'purple',
  alerting: 'red',
  app: 'darkgrey',
};

function kindLabel(kind: PageHistoryKind): string {
  switch (kind) {
    case 'dashboard':
      return t('home.pick-up-tab.kind-dashboard', 'Dashboard');
    case 'explore':
      return t('home.pick-up-tab.kind-explore', 'Explore');
    case 'investigation':
      return t('home.pick-up-tab.kind-investigation', 'Investigation');
    case 'alerting':
      return t('home.pick-up-tab.kind-alerting', 'Alerting');
    case 'app':
      return t('home.pick-up-tab.kind-app', 'App');
  }
}

export function PickUpTab({ items, loading, error, retry, foldersByUid, density }: Props) {
  const redesignEnabled = useFlagGrafanaGrowthHomepage();
  const styles = useStyles2(getStyles, redesignEnabled);

  if (loading) {
    return <PageLoader text={t('home.pick-up-tab.loading', 'Loading your recent activity...')} />;
  }

  if (error) {
    return (
      <DashboardTabError
        title={t('home.pick-up-tab.error-title', 'Could not load your recent activity')}
        retry={retry}
      />
    );
  }

  if (items.length === 0) {
    return (
      <DashboardTabEmptyState
        message={t('home.pick-up-tab.empty', 'Nothing to pick up yet. Pages you visit will show up here.')}
        variant="completed"
        density={density}
      />
    );
  }

  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item.entry.key}>
          <ListRow
            isCompact={density === 'compact'}
            title={item.title}
            subtitle={
              [item.location && foldersByUid[item.location]?.name, item.state].filter(Boolean).join(' · ') || undefined
            }
            href={item.entry.href}
            onClick={() =>
              ctaClicked({ surface: 'pick_up_tab', action: 'open_page', placement: 'list', page_kind: item.entry.kind })
            }
            trailing={
              <Stack gap={1} alignItems="center">
                <Badge text={kindLabel(item.entry.kind)} color={KIND_COLOR[item.entry.kind]} />
                <SummaryCardAge date={item.entry.lastVisited} />
              </Stack>
            }
          />
        </li>
      ))}
    </ul>
  );
}

const getStyles = (theme: GrafanaTheme2, redesign: boolean) => ({
  list: css({
    listStyle: 'none',
    padding: theme.spacing(0, redesign ? 0 : 0.5),
    margin: 0,
  }),
});
