import { useLayoutEffect, useState } from 'react';
import Skeleton from 'react-loading-skeleton';
import { useAsync } from 'react-use';

import { Stack } from '@grafana/ui';

import { type SignalStatus } from '../solutions/solutionState';
import { type Solution, type SolutionId } from '../solutions/types';

import { ExistingSolutionCard } from './ExistingSolutionCard';
import { NoDataCard } from './NoDataCard';

interface RecommendationExistingProps {
  /** Selection the card displays: undefined while providers settle, null when none exists, else the id. */
  onSelectionChange?: (id: SolutionId | null | undefined) => void;
  /** Order used after filtering to solutions with data; signals decide the no-data copy. */
  solutions: Solution[];
}

export function RecommendationExisting({ onSelectionChange, solutions }: RecommendationExistingProps) {
  const [selectedId, setSelectedId] = useState<SolutionId>();
  // Wait only for the facts that choose this card and its no-data copy.
  const resolved = useAsync(
    async () =>
      Promise.all(
        solutions.map(async (solution) => ({
          solution,
          signal: await solution.signal().catch(() => 'unknown' as const),
        }))
      ),
    [solutions]
  );
  const loading = resolved.value === undefined;
  const existing = (resolved.value ?? []).filter(({ signal }) => signal === 'active').map(({ solution }) => solution);

  // The effective selection (explicit pick ?? default) is computed before the early returns so
  // the report effect runs unconditionally (Rules of Hooks). While loading it reports undefined
  // (the parent holds the carousel skeleton); settled with no solution it reports null (the
  // parent shows the global list).
  const selected: Solution | undefined = existing.find((item) => item.id === selectedId) ?? existing[0];
  const effectiveId = loading ? undefined : (selected?.id ?? null);
  // useLayoutEffect: the parent's carousel swap commits before paint, so the list never
  // flashes the global order once the default selection settles.
  useLayoutEffect(() => {
    onSelectionChange?.(effectiveId);
  }, [effectiveId, onSelectionChange]);

  if (loading) {
    return <RecommendationExistingSkeleton />;
  }

  if (!selected) {
    // NoDataCard's hard claim is only true when every core signal settled inactive. Anything
    // inconclusive gets neutral copy so the card never overclaims.
    const core: SignalStatus[] = (resolved.value ?? []).map(({ signal }) => signal);
    const variant = core.length > 0 && core.every((v) => v === 'inactive') ? 'empty' : 'unknown';
    return <NoDataCard variant={variant} />;
  }

  return <ExistingSolutionCard key={selected.id} existing={existing} selected={selected} onSelect={setSelectedId} />;
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
