import { css } from '@emotion/css';

import { type GrafanaTheme2, type NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useFlagGrafanaGrowthHomepage } from '@grafana/runtime/internal';
import { Badge, type BadgeColor, Stack, useStyles2 } from '@grafana/ui';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { type LocationInfo } from 'app/features/search/service/types';
import { ListRow } from 'app/plugins/panel/dashlist/ListRow';
import { useSelector } from 'app/types/store';

import { SummaryCardAge } from '../AlertsIncidents/SummaryCard';
import { ctaClicked } from '../analytics/main';

import { DashboardTabEmptyState } from './DashboardTabEmptyState';
import { DashboardTabError } from './DashboardTabError';
import { SEPARATOR, describeAppState, describeDashboardState, getNavTitle } from './describePageState';
import { type PickUpItem } from './getPickUpItems';

interface Props {
  items: PickUpItem[];
  loading: boolean;
  error: Error | undefined;
  retry: () => void;
  foldersByUid: Record<string, LocationInfo>;
  density?: 'default' | 'compact'; // 'compact' is only used in the homepage redesign
}

interface Row {
  title: string;
  /** What the link restores (folder and time range, datasource and query, filters); blanks are dropped. */
  details: Array<string | undefined>;
  badge: { text: string; color: BadgeColor };
}

/** Everything a row shows for one kind of page, in one place. */
function toRow(item: PickUpItem, navTree: NavModelItem[], foldersByUid: Record<string, LocationInfo>): Row {
  const { pathname, search } = new URL(item.href, 'http://localhost');
  switch (item.kind) {
    case 'dashboard':
      return {
        title: item.dashboard.name,
        details: [foldersByUid[item.dashboard.location]?.name, describeDashboardState(search)],
        badge: { text: t('home.pick-up-tab.kind-dashboard', 'Dashboard'), color: 'blue' },
      };
    case 'explore':
      return {
        title: t('home.pick-up-tab.kind-explore', 'Explore'),
        details: [item.state],
        badge: { text: t('home.pick-up-tab.kind-explore', 'Explore'), color: 'orange' },
      };
    case 'investigation':
      return {
        title: t('home.pick-up-tab.investigation', 'Investigation {{id}}', { id: item.id.slice(0, 8) }),
        details: [getNavTitle(navTree, `/a/${item.pluginId}`) ?? item.pluginId],
        badge: { text: t('home.pick-up-tab.kind-investigation', 'Investigation'), color: 'purple' },
      };
    case 'alerting':
      return {
        title: getNavTitle(navTree, pathname) ?? pathname,
        details: [describeAppState(search)],
        badge: { text: t('home.pick-up-tab.kind-alerting', 'Alerting'), color: 'red' },
      };
    case 'app':
      return {
        title: getNavTitle(navTree, pathname) ?? pathname,
        details: [describeAppState(search)],
        badge: { text: t('home.pick-up-tab.kind-app', 'App'), color: 'darkgrey' },
      };
  }
}

export function PickUpTab({ items, loading, error, retry, foldersByUid, density }: Props) {
  const redesignEnabled = useFlagGrafanaGrowthHomepage();
  const styles = useStyles2(getStyles, redesignEnabled);
  const navTree = useSelector((state) => state.navBarTree);

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
      {items.map((item) => {
        const row = toRow(item, navTree, foldersByUid);
        return (
          <li key={item.href}>
            <ListRow
              isCompact={density === 'compact'}
              title={row.title}
              subtitle={row.details.filter(Boolean).join(SEPARATOR) || undefined}
              href={item.href}
              onClick={() =>
                ctaClicked({ surface: 'pick_up_tab', action: 'open_page', placement: 'list', page_kind: item.kind })
              }
              trailing={
                <Stack gap={1} alignItems="center">
                  <Badge text={row.badge.text} color={row.badge.color} />
                  <SummaryCardAge date={item.lastVisited} />
                </Stack>
              }
            />
          </li>
        );
      })}
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
