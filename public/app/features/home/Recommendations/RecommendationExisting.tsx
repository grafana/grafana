import { useState } from 'react';
import Skeleton from 'react-loading-skeleton';

import { Stack } from '@grafana/ui';

import { ExistingSolutionCard } from './ExistingSolutionCard';
import { NoDataCard } from './NoDataCard';
import { useSolutionState } from './solutionState';
import { useExistingSolutions } from './useExistingSolutions';

export function RecommendationExisting() {
  const [selectedTitle, setSelectedTitle] = useState<string>();
  const { loading, solutions } = useExistingSolutions();
  // Shares the TTL-cached resolution with useExistingSolutions — no extra probes.
  const { value: resolution } = useSolutionState();

  if (loading) {
    return <RecommendationExistingSkeleton />;
  }

  if (solutions.length === 0) {
    // NoDataCard's hard claim is only true when every core signal settled inactive; anything
    // else (active-but-no-entry, unknown) gets the softened variant.
    const s = resolution?.state;
    const allInactive =
      !!s &&
      s.metrics === 'inactive' &&
      s.logs === 'inactive' &&
      s.traces === 'inactive' &&
      s.kubernetes === 'inactive';
    return <NoDataCard variant={allInactive ? 'empty' : 'partial'} />;
  }

  const selected = solutions.find((item) => item.title === selectedTitle) ?? solutions[0];
  return <ExistingSolutionCard existing={solutions} selected={selected} onSelect={setSelectedTitle} />;
}

// Mirrors the card body (dropdown pill, icon + title, stats, CTA) while the solution
// lookups load, so the first paint never shows a solution that a resolving fetch would replace.
function RecommendationExistingSkeleton() {
  return (
    <Stack
      direction="column"
      justifyContent="space-between"
      gap={2}
      flex={1}
      data-testid="recommendation-existing-skeleton"
    >
      <Stack direction="column" gap={1.5}>
        <Skeleton width={240} height={30} />
        <Stack direction="row" alignItems="center" gap={1.5}>
          <Skeleton width={44} height={44} />
          <Skeleton width={200} height={24} />
        </Stack>
      </Stack>

      <Stack direction="column" gap={0}>
        <Skeleton width={140} height={35} />
        <Skeleton width={100} height={20} />
      </Stack>

      <Stack direction="row" alignItems="center">
        <Skeleton width={170} height={32} />
      </Stack>
    </Stack>
  );
}
