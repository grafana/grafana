import { css } from '@emotion/css';
import Skeleton from 'react-loading-skeleton';

import { Stack } from '@grafana/ui';

// Mirrors the real DashboardTabs body while its fetches load.
export function DashboardTabsSkeleton() {
  return (
    <Stack direction="column" gap={2} data-testid="dashboard-tabs-skeleton">
      <Stack direction="row" gap={2}>
        <Skeleton width={140} height={24} />
        <Skeleton width={140} height={24} />
      </Stack>
      <Skeleton height={256} containerClassName={styles.block} />
    </Stack>
  );
}

const styles = {
  block: css({
    display: 'block',
  }),
};
