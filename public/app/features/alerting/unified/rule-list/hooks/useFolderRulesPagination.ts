import { useCallback, useMemo, useRef, useState } from 'react';

import { GrafanaPromRuleDTO, GrafanaPromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { prometheusApi } from '../../api/prometheusApi';

const { useLazyGetGrafanaGroupsQuery } = prometheusApi;

export interface RuleWithGroup {
  rule: GrafanaPromRuleDTO;
  group: GrafanaPromRuleGroupDTO;
}

interface UseFolderRulesPaginationParams {
  folderUid: string;
  pageSize?: number;
}

interface UseFolderRulesPaginationResult {
  /** Rules currently visible, grouped by their evaluation group */
  rulesByGroup: Map<string, RuleWithGroup[]>;
  /** Whether there are more rules to load */
  hasMore: boolean;
  /** Load more rules */
  loadMore: () => void;
  /** Whether currently loading */
  isLoading: boolean;
  /** Error if any */
  error: Error | undefined;
  /** Total number of visible rules */
  visibleRulesCount: number;
}

const DEFAULT_PAGE_SIZE = 40;

/**
 * Hook for folder-level rule pagination.
 *
 * Uses the `rule_limit` API parameter to fetch groups with a limit on total rules.
 * When "Load more" is clicked, fetches the next page of rules from the API.
 *
 * Note: The API returns full groups, so the actual number of rules may exceed the limit.
 */
export function useFolderRulesPagination({
  folderUid,
  pageSize = DEFAULT_PAGE_SIZE,
}: UseFolderRulesPaginationParams): UseFolderRulesPaginationResult {
  const [getGrafanaGroups] = useLazyGetGrafanaGroupsQuery();

  // Store all fetched groups
  const [groups, setGroups] = useState<GrafanaPromRuleGroupDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);

  // Track pagination token for API
  const nextTokenRef = useRef<string | undefined>(undefined);

  // Track if initial fetch has been done
  const hasFetchedRef = useRef(false);

  // Flatten all rules from all groups with their group reference
  const allRules: RuleWithGroup[] = useMemo(() => {
    return groups.flatMap((group) => group.rules.map((rule) => ({ rule, group })));
  }, [groups]);

  // Group rules by their group name for rendering
  const rulesByGroup = useMemo(() => {
    const grouped = new Map<string, RuleWithGroup[]>();
    for (const item of allRules) {
      const key = item.group.name;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(item);
    }
    return grouped;
  }, [allRules]);

  const fetchMore = useCallback(async () => {
    if (isLoading || (!hasMore && hasFetchedRef.current)) {
      return;
    }

    setIsLoading(true);
    setError(undefined);

    try {
      const response = await getGrafanaGroups({
        folderUid,
        ruleLimit: pageSize,
        groupNextToken: nextTokenRef.current,
        limitAlerts: 0, // Don't limit alerts for rule display
      }).unwrap();

      const newGroups = response.data.groups;

      setGroups((prev) => {
        // Merge groups - if a group already exists, we might need to update it
        // (though typically the API returns distinct groups per page)
        const existingGroupNames = new Set(prev.map((g) => g.name));
        const uniqueNewGroups = newGroups.filter((g) => !existingGroupNames.has(g.name));
        return [...prev, ...uniqueNewGroups];
      });

      nextTokenRef.current = response.data.groupNextToken;
      setHasMore(Boolean(response.data.groupNextToken));
      hasFetchedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch rules'));
    } finally {
      setIsLoading(false);
    }
  }, [folderUid, getGrafanaGroups, hasMore, isLoading, pageSize]);

  // Auto-fetch on first render
  if (!hasFetchedRef.current && !isLoading) {
    fetchMore();
  }

  return {
    rulesByGroup,
    hasMore,
    loadMore: fetchMore,
    isLoading,
    error,
    visibleRulesCount: allRules.length,
  };
}
