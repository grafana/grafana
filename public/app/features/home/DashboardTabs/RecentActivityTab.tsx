import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Badge, Stack, useStyles2 } from '@grafana/ui';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { type LocationInfo } from 'app/features/search/service/types';
import { ListRow } from 'app/plugins/panel/dashlist/ListRow';
import { useSelector } from 'app/types/store';

import { TimeAgoCell } from '../TimeAgoCell';
import { ctaClicked } from '../analytics/main';

import { DashboardTabEmptyState } from './DashboardTabEmptyState';
import { DashboardTabError } from './DashboardTabError';
import { type RecentActivityItem, getPageKindMeta, toRow } from './pageKinds';

interface Props {
  items: RecentActivityItem[];
  loading: boolean;
  error: Error | undefined;
  retry: () => void;
  foldersByUid: Record<string, LocationInfo>;
  density?: 'default' | 'compact';
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
