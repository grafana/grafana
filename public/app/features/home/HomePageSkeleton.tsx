import { css } from '@emotion/css';
import Skeleton from 'react-loading-skeleton';

import { Stack } from '@grafana/ui';

import { DashboardTabsSkeleton } from './DashboardTabs/DashboardTabsSkeleton';
import { HomeGrid } from './HomeGrid';
import { HomeSection } from './HomeSection';

interface Props {
  showAlertsCard?: boolean;
  showIRMNewsCard?: boolean;
  showExtra?: boolean;
  showSolutions?: boolean;
  redesignEnabled?: boolean;
}

// Opt-in sections so the skeleton never reserves a block the real page won't render.
export function HomePageSkeleton({
  showAlertsCard,
  showIRMNewsCard,
  showExtra,
  showSolutions,
  redesignEnabled,
}: Props) {
  return (
    <div data-testid="home-page-skeleton">
      <Stack direction="column" gap={2}>
        {redesignEnabled ? (
          <>
            {/* DashboardTabs and Alerts card*/}
            <HomeGrid columns={2} gap={2} data-testid="home-page-skeleton-cards">
              <HomeSection direction="column" display="flex" gap={2}>
                <DashboardTabsSkeleton redesignEnabled />
              </HomeSection>
              {showAlertsCard && <CardSkeleton />}
            </HomeGrid>
            {/* Recommendations / overview block below the grid: heading + card */}
            {showSolutions && (
              <HomeSection direction="column" display="flex" gap={2} data-testid="home-page-skeleton-solutions">
                <Skeleton width={280} height={24} />
                <Skeleton height={120} containerClassName={styles.block} />
              </HomeSection>
            )}
          </>
        ) : (
          <>
            <HomeSection direction="column" display="flex" gap={2}>
              <DashboardTabsSkeleton />
            </HomeSection>
            {(showAlertsCard || showIRMNewsCard) && (
              <HomeGrid columns={2} gap={2} data-testid="home-page-skeleton-cards">
                {showAlertsCard && <CardSkeleton />}
                {showIRMNewsCard && <CardSkeleton />}
              </HomeGrid>
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
