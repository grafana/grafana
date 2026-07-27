import { css } from '@emotion/css';
import Skeleton from 'react-loading-skeleton';

import { Grid, Stack } from '@grafana/ui';

import { DashboardTabsSkeleton } from './DashboardTabs/DashboardTabsSkeleton';
import { HomeSection } from './HomeSection';

interface Props {
  showAlertsCard?: boolean;
  showExtra?: boolean;
  redesignEnabled?: boolean;
}

// Opt-in sections so the skeleton never reserves a block the real page won't render.
export function HomePageSkeleton({ showAlertsCard, showExtra, redesignEnabled }: Props) {
  return (
    <div data-testid="home-page-skeleton">
      <Stack direction="column" gap={2}>
        {redesignEnabled ? (
          <>
            {/* Recommendations block: heading + carousel card */}
            <HomeSection direction="column" display="flex" gap={2}>
              <Skeleton width={280} height={24} />
              <Skeleton height={120} containerClassName={styles.block} />
            </HomeSection>
            {/* DashboardTabs and Alerts card*/}
            <Grid gap={2} columns={{ xs: 1, md: 2 }} data-testid="home-page-skeleton-cards">
              <HomeSection direction="column" display="flex" gap={2}>
                <DashboardTabsSkeleton redesignEnabled />
              </HomeSection>
              {showAlertsCard && <CardSkeleton />}
            </Grid>
          </>
        ) : (
          <>
            <HomeSection direction="column" display="flex" gap={2}>
              <DashboardTabsSkeleton />
            </HomeSection>
            {showAlertsCard && (
              <Grid gap={2} columns={{ xs: 1, md: 2 }} data-testid="home-page-skeleton-cards">
                <CardSkeleton />
              </Grid>
            )}
          </>
        )}
        {showExtra && (
          <HomeSection data-testid="home-page-skeleton-extra">
            <Skeleton height={120} containerClassName={styles.block} />
          </HomeSection>
        )}
      </Stack>
    </div>
  );
}

// Mirrors SummaryCard's loading state.
function CardSkeleton() {
  return (
    <HomeSection display="flex" direction="column">
      <Stack direction="column" gap={2}>
        <Skeleton width={140} height={24} />
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} height={20} />
        ))}
      </Stack>
    </HomeSection>
  );
}

const styles = {
  block: css({
    display: 'block',
  }),
};
