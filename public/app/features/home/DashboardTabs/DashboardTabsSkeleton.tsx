import { css } from '@emotion/css';
import Skeleton from 'react-loading-skeleton';

import { Stack } from '@grafana/ui';

import { DASHBOARD_TABS_SCROLL_HEIGHT_DEFAULT, DASHBOARD_TABS_SCROLL_HEIGHT_REDESIGN } from './types';

interface Props {
  redesignEnabled?: boolean;
}

// Mirrors the real DashboardTabs body while its fetches load.
export function DashboardTabsSkeleton({ redesignEnabled }: Props) {
  const height = redesignEnabled ? DASHBOARD_TABS_SCROLL_HEIGHT_REDESIGN : DASHBOARD_TABS_SCROLL_HEIGHT_DEFAULT;

  return (
    <Stack direction="column" gap={2} data-testid="dashboard-tabs-skeleton">
      <Stack direction="row" gap={2}>
        <Skeleton width={140} height={24} />
        <Skeleton width={140} height={24} />
      </Stack>
      <Skeleton height={height} containerClassName={styles.block} />
    </Stack>
  );
}

const styles = {
  block: css({
    display: 'block',
  }),
};
