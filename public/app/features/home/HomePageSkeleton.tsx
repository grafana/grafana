import { css } from '@emotion/css';
import Skeleton from 'react-loading-skeleton';

import { Grid, Stack } from '@grafana/ui';

import { HomeSection } from './HomeSection';

interface Props {
  showAlertsCard?: boolean;
  showExtra?: boolean;
}

// Opt-in sections so the skeleton never reserves a block the real page won't render.
export function HomePageSkeleton({ showAlertsCard, showExtra }: Props) {
  return (
    <div data-testid="home-page-skeleton">
      <Stack direction="column" gap={2}>
        <HomeSection direction="column" display="flex" gap={2}>
          <Stack direction="row" gap={2}>
            <Skeleton width={140} height={24} />
            <Skeleton width={140} height={24} />
          </Stack>
          <Skeleton height={256} containerClassName={styles.block} />
        </HomeSection>

        {showAlertsCard && (
          <Grid gap={2} columns={{ xs: 1, md: 2 }} data-testid="home-page-skeleton-cards">
            <CardSkeleton />
          </Grid>
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
