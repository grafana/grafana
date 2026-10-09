import { css } from '@emotion/css';
import { useEffect, useRef } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Badge, LinkButton, Stack, useStyles2 } from '@grafana/ui';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { contextSrv } from 'app/core/services/context_srv';
import { type LocationInfo } from 'app/features/search/service/types';
import { ListRow } from 'app/plugins/panel/dashlist/ListRow';
import { AccessControlAction } from 'app/types/accessControl';
import { useSelector } from 'app/types/store';

import { TimeAgoCell } from '../TimeAgoCell';
import { ctaClicked, recentActivityShown } from '../analytics/main';

import { DashboardTabEmptyState } from './DashboardTabEmptyState';
import { DashboardTabError } from './DashboardTabError';
import { type PageKindCounts, type RecentActivityItem, getPageKindMeta, toRow } from './recentActivityRows';

interface Props {
  items: RecentActivityItem[];
  /** Over the whole history, so what was shown is reported independently of the kind filter. */
  counts: PageKindCounts;
  loading: boolean;
  error: Error | undefined;
  retry: () => void;
  foldersByUid: Record<string, LocationInfo>;
  density?: 'default' | 'compact';
}

/** An empty history means a new user or a fresh clear: point them at dashboards, as the Recent tab always did. */
function EmptyStateCta() {
  if (contextSrv.hasPermission(AccessControlAction.DashboardsCreate)) {
    return (
      <LinkButton
        icon="plus"
        href="/dashboard/new"
        onClick={() => ctaClicked({ surface: 'recent_tab', action: 'create_dashboard', placement: 'empty_state' })}
      >
        <Trans i18nKey="home.recent-activity-tab.create">Create your first dashboard</Trans>
      </LinkButton>
    );
  }
  return (
    <LinkButton
      icon="apps"
      href="/dashboards"
      variant="secondary"
      onClick={() => ctaClicked({ surface: 'recent_tab', action: 'browse_dashboards', placement: 'empty_state' })}
    >
      <Trans i18nKey="home.recent-activity-tab.browse">Browse dashboards</Trans>
    </LinkButton>
  );
}

export function RecentActivityTab({ items, counts, loading, error, retry, foldersByUid, density }: Props) {
  const styles = useStyles2(getStyles, density === 'compact');
  const navTree = useSelector((state) => state.navBarTree);

  // Once per display: the tab mounts when it becomes active and unmounts when the user leaves it.
  const shown = useRef(false);
  useEffect(() => {
    if (shown.current || loading || error) {
      return;
    }
    shown.current = true;
    recentActivityShown({
      page_count: counts.dashboard + counts.explore + counts.alerting + counts.app,
      dashboard_count: counts.dashboard,
      explore_count: counts.explore,
      alerting_count: counts.alerting,
      app_count: counts.app,
    });
  }, [loading, error, counts]);

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
        variant="call-to-action"
        button={<EmptyStateCta />}
        density={density}
      />
    );
  }

  return (
    <ul className={styles.list}>
      {items.map((item, position) => {
        const href = item.pathname + item.search;
        const { title, subtitle } = toRow(item, navTree, foldersByUid);
        const { badge, color } = getPageKindMeta(item.kind);
        return (
          <li key={href}>
            <ListRow
              isCompact={density === 'compact'}
              title={title}
              subtitle={subtitle}
              href={href}
              onClick={() =>
                ctaClicked({
                  surface: 'recent_tab',
                  action: 'open_page',
                  placement: 'list',
                  page_kind: item.kind,
                  position,
                })
              }
              trailing={
                <Stack gap={0.5} alignItems="center">
                  <span className={styles.kind}>
                    <Badge text={badge} color={color} />
                  </span>
                  <TimeAgoCell date={item.lastVisited} />
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
