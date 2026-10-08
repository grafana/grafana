import { css } from '@emotion/css';

import { type GrafanaTheme2, type NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Badge, Stack, useStyles2 } from '@grafana/ui';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { type LocationInfo } from 'app/features/search/service/types';
import { ListRow } from 'app/plugins/panel/dashlist/ListRow';
import { useSelector } from 'app/types/store';

import { SummaryCardAge } from '../AlertsIncidents/SummaryCard';
import { ctaClicked } from '../analytics/main';

import { DashboardTabEmptyState } from './DashboardTabEmptyState';
import { DashboardTabError } from './DashboardTabError';
import {
  SEPARATOR,
  describeAppState,
  describeDashboardState,
  describeExploreState,
  getNavTitle,
} from './describePageState';
import { getPageKindMeta } from './pageKinds';
import { type RecentActivityItem } from './useRecentActivity';

interface Props {
  items: RecentActivityItem[];
  loading: boolean;
  error: Error | undefined;
  retry: () => void;
  foldersByUid: Record<string, LocationInfo>;
  density?: 'default' | 'compact';
}

interface Row {
  title: string;
  /** What the link restores (folder and time range, datasource and query, filters); blanks are dropped. */
  details: Array<string | undefined>;
}

const AREA_PREFIX = { alerting: /^\/alerting\/?/, app: /^\/a\/?/ };

/** Everything a row shows for one kind of page, in one place. */
function toRow(item: RecentActivityItem, navTree: NavModelItem[], foldersByUid: Record<string, LocationInfo>): Row {
  switch (item.kind) {
    case 'dashboard':
      return {
        title: item.dashboard.name,
        details: [foldersByUid[item.dashboard.location]?.name, describeDashboardState(item.search)],
      };
    case 'explore':
      return {
        title: t('home.recent-activity-tab.kind-explore', 'Explore'),
        details: [describeExploreState(item.panes)],
      };
    case 'alerting':
    case 'app': {
      // Pages in the nav tree use their nav label. Deep links use the title the page set, which
      // often is just the section's ("Incidents" for every incident), so the path tells them apart.
      const navTitle = getNavTitle(navTree, item.pathname);
      const title = navTitle ?? item.title ?? item.pathname;
      const showPath = !navTitle && title !== item.pathname;
      return {
        title,
        // The badge already names the area, so the path drops its `/alerting` or `/a` prefix.
        details: [
          showPath ? item.pathname.replace(AREA_PREFIX[item.kind], '') : undefined,
          describeAppState(item.search),
        ],
      };
    }
  }
}

export function RecentActivityTab({ items, loading, error, retry, foldersByUid, density }: Props) {
  const styles = useStyles2(getStyles, density === 'compact');
  const navTree = useSelector((state) => state.navBarTree);

  if (loading) {
    return <PageLoader text={t('home.recent-activity-tab.loading', 'Loading your recent activity...')} />;
  }

  if (error) {
    return (
      <DashboardTabError
        title={t('home.recent-activity-tab.error-title', 'Could not load your recent activity')}
        retry={retry}
      />
    );
  }

  if (items.length === 0) {
    return (
      <DashboardTabEmptyState
        message={t('home.recent-activity-tab.empty', 'No recent activity yet. Pages you visit will show up here.')}
        variant="completed"
        density={density}
      />
    );
  }

  return (
    <ul className={styles.list}>
      {items.map((item) => {
        const href = item.pathname + item.search;
        const row = toRow(item, navTree, foldersByUid);
        const { badge, color } = getPageKindMeta(item.kind);
        return (
          <li key={href}>
            <ListRow
              isCompact={density === 'compact'}
              title={row.title}
              subtitle={row.details.filter(Boolean).join(SEPARATOR) || undefined}
              href={href}
              onClick={() =>
                ctaClicked({
                  surface: 'recent_activity_tab',
                  action: 'open_page',
                  placement: 'list',
                  page_kind: item.kind,
                })
              }
              trailing={
                <Stack gap={0.5} alignItems="center">
                  <span className={styles.kind}>
                    <Badge text={badge} color={color} />
                  </span>
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

const getStyles = (theme: GrafanaTheme2, compact: boolean) => ({
  list: css({
    listStyle: 'none',
    padding: theme.spacing(0, compact ? 0 : 0.5),
    margin: 0,
  }),
  // Fixed column sized for the widest badge ("Dashboard"), badges centered in it, so the column
  // reads as one block next to the right-aligned times.
  kind: css({
    display: 'inline-flex',
    flexShrink: 0,
    justifyContent: 'center',
    minWidth: theme.spacing(10),
  }),
});
