import { useEffect, useRef, useState } from 'react';

import { type PromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { isLoading as isLoadingState, isUninitialized, useAsync } from '../../hooks/useAsync';

/**
 * Provides lazy loading for rule groups.
 * Instead of loading all groups at once, it uses a generator to fetch them in batches as needed,
 * which helps with performance when dealing with large numbers of rules.
 *
 * @param createGroupsGenerator - Creates the async generator that yields rule groups in batches.
 *   Called once on mount; the generator is closed on unmount.
 * @param pageSize - Number of groups to display per page
 * @returns Groups loaded so far and controls for navigating through rule groups
 */
export function useLazyLoadPrometheusGroups<TGroup extends PromRuleGroupDTO>(
  createGroupsGenerator: () => AsyncGenerator<TGroup, unknown, unknown>,
  pageSize: number,
  filter?: (group: TGroup) => boolean
) {
  const [groups, setGroups] = useState<TGroup[]>([]);
  const [hasMoreGroups, setHasMoreGroups] = useState<boolean>(true);
  const generatorRef = useRef<AsyncGenerator<TGroup, unknown, unknown>>(undefined);

  const [{ execute: fetchMoreGroups }, groupsRequestState] = useAsync(async () => {
    const generator = generatorRef.current;
    if (!generator) {
      return;
    }

    let done = false;
    const currentGroups: TGroup[] = [];

    while (currentGroups.length < pageSize) {
      const generatorResult = await generator.next();
      if (generatorResult.done) {
        done = true;
        break;
      }

      const group = generatorResult.value;
      if (filter && !filter(group)) {
        continue;
      }

      currentGroups.push(group);
    }

    // The generator was closed and replaced while we were fetching (StrictMode remount),
    // so these groups belong to the old one and would show up twice.
    if (generator !== generatorRef.current) {
      return;
    }

    if (done) {
      setHasMoreGroups(false);
    }

    setGroups((groups) => groups.concat(currentGroups));
  });

  // The generator is created and closed in the same effect, so a StrictMode remount
  // just closes the first one and starts a fresh one.
  useEffect(() => {
    const generator = createGroupsGenerator();
    generatorRef.current = generator;
    fetchMoreGroups();

    return () => {
      generator.return(undefined);
    };
    // Only run on mount. Callers use `key` to start over when their inputs change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Treat the pre-fetch state as loading so consumers don't mistake it for a confirmed empty result.
  const isLoading = isLoadingState(groupsRequestState) || isUninitialized(groupsRequestState);

  return {
    isLoading,
    error: groupsRequestState.error,
    groups,
    hasMoreGroups,
    fetchMoreGroups,
  };
}
