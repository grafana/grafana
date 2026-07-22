import { css } from '@emotion/css';
import Skeleton from 'react-loading-skeleton';

import { type GrafanaTheme2 } from '@grafana/data';
import { Grid, Stack, useStyles2 } from '@grafana/ui';

// Mirrors the RecommendationsView shell (heading row + two-column card grid) so the
// section holds its space while the plugin list and data probes resolve.
export function RecommendationsSkeleton() {
  const styles = useStyles2(getStyles);

  return (
    <div data-testid="recommendations-skeleton">
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
        <Skeleton width={280} height={24} />
        <Skeleton width={60} height={24} />
      </Stack>

      <div className={styles.cards}>
        <Grid gap={0} columns={{ xs: 1, md: 2 }}>
          <div className={styles.card}>
            <Stack direction="column" gap={2}>
              <Skeleton width={160} height={22} />
              <Skeleton width={240} height={30} />
              <Skeleton height={20} />
              <Skeleton width={170} height={32} />
            </Stack>
          </div>

          <div className={styles.card}>
            <Stack direction="column" gap={2}>
              <Skeleton width={120} height={22} />
              <Skeleton width={240} height={30} />
              <Skeleton height={20} />
              <Skeleton width={170} height={32} />
            </Stack>
          </div>
        </Grid>
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  cards: css({
    background: theme.colors.background.canvas,
    borderRadius: theme.shape.radius.default,
    margin: theme.spacing(2, 0, 0),
    overflow: 'hidden',
  }),
  card: css({
    padding: theme.spacing(3, 4),
    minWidth: 0,
  }),
});
