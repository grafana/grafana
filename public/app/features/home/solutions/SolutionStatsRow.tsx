import { css } from '@emotion/css';
import { type ComponentProps } from 'react';
import Skeleton from 'react-loading-skeleton';
import { useAsync } from 'react-use';

import { Stack, Text, useStyles2 } from '@grafana/ui';

import { SolutionSparkline, type SolutionSparklineData } from './SolutionSparkline';
import { type SolutionStats } from './types';

interface SolutionStatsRowProps {
  stats: () => Promise<SolutionStats | null>;
  /** Optional replacement for the base stats when richer data resolves. */
  refinedStats: () => Promise<SolutionStats | null>;
  sparkline: () => Promise<SolutionSparklineData | null>;
  /** Overview cards render denser stats; the recommendations card keeps the large defaults. */
  compact?: boolean;
  gap?: ComponentProps<typeof Stack>['gap'];
  statsTestId?: string;
  sparklineTestId?: string;
}

export function SolutionStatsRow({
  stats,
  refinedStats,
  sparkline,
  gap = 2,
  compact = false,
  statsTestId,
  sparklineTestId,
}: SolutionStatsRowProps) {
  const styles = useStyles2(getStyles);
  // useAsync retains the previous value while re-resolving (the fact fns change identity when a
  // solution rebuilds, e.g. after a Kubernetes filter save); a pending fact reads as null so the
  // old scope's numbers never render. Refinement is optional: pending, it yields to the base.
  const { value: base = null, loading: statsPending } = useAsync(stats, [stats]);
  const { value: refined = null, loading: refinedPending } = useAsync(refinedStats, [refinedStats]);
  const resolvedStats = statsPending ? null : ((refinedPending ? null : refined) ?? base);
  const { value: retainedTrend = null, loading: sparklinePending } = useAsync(sparkline, [sparkline]);
  const trend = sparklinePending ? null : retainedTrend;

  const showStats = statsPending || resolvedStats !== null;
  const showSparkline = sparklinePending || trend !== null;
  if (!showStats && !showSparkline) {
    return null;
  }

  return (
    <Stack direction="row" gap={gap} alignItems="center">
      {showStats && (
        <div className={styles.stats}>
          {resolvedStats === null ? (
            <Stack direction="column" gap={0} data-testid={statsTestId}>
              <Skeleton width={96} height={compact ? 22 : 28} />
              <Skeleton width={72} />
            </Stack>
          ) : (
            <Stack direction="column" gap={0}>
              <Text variant={compact ? 'h3' : 'h2'} color="primary">
                {resolvedStats.primary}
              </Text>
              {resolvedStats.secondary && (
                <Text variant={compact ? 'bodySmall' : 'body'} color="secondary">
                  {resolvedStats.secondary}
                </Text>
              )}
            </Stack>
          )}
        </div>
      )}

      {showSparkline && (
        <div className={styles.sparkline} data-testid={trend === null ? sparklineTestId : undefined}>
          {trend === null ? <Skeleton height={56} /> : <SolutionSparkline sparkline={trend} />}
        </div>
      )}
    </Stack>
  );
}

const getStyles = () => ({
  stats: css({
    flexShrink: 0,
  }),
  sparkline: css({
    flex: '1 1 auto',
    minWidth: 0,
  }),
});
