import { css } from '@emotion/css';
import Skeleton from 'react-loading-skeleton';

import { type GrafanaTheme2 } from '@grafana/data';
import { Stack, useStyles2 } from '@grafana/ui';

import { DASHBOARD_TABS_SCROLL_HEIGHT_DEFAULT, DASHBOARD_TABS_SCROLL_HEIGHT_REDESIGN } from './types';

interface Props {
  redesignEnabled?: boolean;
}

/**
 * Stands in for the tab bar and list while the tabs' fetches load: the tabs can't render before it is known
 * which one to land on. Same row placeholders as the summary cards, so the homepage loads as one.
 */
export function DashboardTabsSkeleton({ redesignEnabled }: Props) {
  const styles = useStyles2(
    getStyles,
    redesignEnabled ? DASHBOARD_TABS_SCROLL_HEIGHT_REDESIGN : DASHBOARD_TABS_SCROLL_HEIGHT_DEFAULT
  );

  return (
    <Stack direction="column" gap={2} data-testid="dashboard-tabs-skeleton">
      <Stack direction="row" gap={2}>
        <Skeleton width={140} height={24} />
        <Skeleton width={140} height={24} />
      </Stack>
      {/* Reserves the list's height so the card doesn't jump when the rows arrive. */}
      <div className={styles.rows}>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} height={20} />
        ))}
      </div>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2, listHeight: number) => ({
  rows: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    minHeight: listHeight,
  }),
});
