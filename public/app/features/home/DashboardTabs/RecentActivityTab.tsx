import { css } from '@emotion/css';
import { useEffect, useRef } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Badge, LinkButton, Stack, useStyles2 } from '@grafana/ui';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { contextSrv } from 'app/core/services/context_srv';
import { DescriptionTooltip } from 'app/features/search/components/DescriptionTooltip';
import { type LocationInfo } from 'app/features/search/service/types';
import { StarToolbarButton } from 'app/features/stars/StarToolbarButton';
import { ListRow } from 'app/plugins/panel/dashlist/ListRow';
import { AccessControlAction } from 'app/types/accessControl';
import { useSelector } from 'app/types/store';

import { HomeList } from '../HomeList';
import { TimeAgoCell } from '../TimeAgoCell';
import { ctaClicked, recentActivityShown } from '../analytics/main';

import { DashboardTabEmptyState } from './DashboardTabEmptyState';
import { DashboardTabError } from './DashboardTabError';
import { getPageKindMeta, toRow } from './recentActivityRows';
import { type RecentActivity } from './useRecentActivity';

interface Props {
  recent: RecentActivity;
  foldersByUid: Record<string, LocationInfo>;
  /** Starring a dashboard here changes what the Starred tab shows. */
  onStarChange: () => void;
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

export function RecentActivityTab({ recent, foldersByUid, onStarChange }: Props) {
  const { items, counts, total, filter, loading, error, retry } = recent;
  const styles = useStyles2(getStyles);
  const navTree = useSelector((state) => state.navBarTree);

  // Once per display: the tab mounts when it becomes active and unmounts when the user leaves it.
  const shown = useRef(false);
  useEffect(() => {
    if (shown.current || loading || error) {
      return;
    }
    shown.current = true;
    recentActivityShown({
      total_count: total,
      dashboard_count: counts.dashboard,
      page_count: counts.page,
      explore_count: counts.explore,
      alerting_count: counts.alerting,
      app_count: counts.app,
      filter,
    });
  }, [loading, error, counts, total, filter]);

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
        button={<EmptyStateCta />}
      />
    );
  }

  // Rows seeded from the recently-viewed impressions carry no visit time. When none of the shown rows has one,
  // the time column would be blank the whole way down, so the kind icons take the right edge instead.
  const showTime = items.some((item) => item.lastVisited !== undefined);

  return (
    <HomeList>
      {items.map((item, position) => {
        const href = item.pathname + item.search;
        const { title, subtitle } = toRow(item, navTree, foldersByUid);
        const { badge, icon } = getPageKindMeta(item.kind);
        return (
          <li key={href}>
            <ListRow
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
                  filter,
                })
              }
              trailing={
                <Stack gap={0.5} alignItems="center">
                  {item.kind === 'dashboard' && <DescriptionTooltip description={item.dashboard.description} />}
                  <span className={styles.star}>
                    {item.kind === 'dashboard' && (
                      <StarToolbarButton
                        title={item.dashboard.name}
                        group="dashboard.grafana.app"
                        kind="Dashboard"
                        id={item.uid}
                        onStarChange={onStarChange}
                      />
                    )}
                  </span>
                  <span className={styles.kind}>
                    <Badge icon={icon} color="orange" tooltip={badge} role="img" aria-label={badge} />
                  </span>
                  {showTime && <TimeAgoCell date={item.lastVisited} />}
                </Stack>
              }
            />
          </li>
        );
      })}
    </HomeList>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // A badge, not a bare icon, so the kind reads as a label and not as another action next to the star. One
  // colour for every kind: the icon says which, the tooltip spells it out.
  kind: css({
    display: 'inline-flex',
    flexShrink: 0,
  }),
  // Only dashboards can be starred. The slot is the button's size on every row so the badge and time columns
  // start at the same place and rows stay one height whether the button is there or not.
  star: css({
    display: 'inline-flex',
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    width: theme.spacing(4.5),
    height: theme.spacing(theme.components.height.md),
  }),
});
