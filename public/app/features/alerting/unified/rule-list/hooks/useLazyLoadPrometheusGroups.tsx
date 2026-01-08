import { useState } from 'react';
import { useEffectOnce } from 'react-use';

import { PromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { isLoading as isLoadingState, useAsync } from '../../hooks/useAsync';

/**
 * Provides lazy loading for rule groups.
 * Instead of loading all groups at once, it uses a generator to fetch them in batches as needed,
 * which helps with performance when dealing with large numbers of rules.
 *
 * @param groupsGenerator - An async generator that yields rule groups in batches
 * @param pageSize - Number of groups to display per page
 * @returns Groups loaded so far and controls for navigating through rule groups
 */
export function useLazyLoadPrometheusGroups<TGroup extends PromRuleGroupDTO>(
  groupsGenerator: AsyncIterator<TGroup>,
  pageSize: number,
  filter?: (group: TGroup) => boolean
) {
  const [groups, setGroups] = useState<TGroup[]>([]);
  const [hasMoreGroups, setHasMoreGroups] = useState<boolean>(true);

  const [{ execute: fetchMoreGroups }, groupsRequestState] = useAsync(async () => {
    let done = false;
    const currentGroups: TGroup[] = [];

    while (currentGroups.length < pageSize) {
      const generatorResult = await groupsGenerator.next();
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

    if (done) {
      setHasMoreGroups(false);
    }

    setGroups((groups) => groups.concat(currentGroups));
  });

  // make sure we only load the initial group exactly once
  useEffectOnce(() => {
    fetchMoreGroups();
  });

  const isLoading = isLoadingState(groupsRequestState);

  return {
    isLoading,
    error: groupsRequestState.error,
    groups,
    hasMoreGroups,
    fetchMoreGroups,
  };
}
