import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type GetSearchRulesApiArg,
  useLazyGetSearchRulesQuery,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { PromRuleType } from 'app/types/unified-alerting-dto';

import { type RuleSearchHit, mapRuleHitToDTO } from './searchRuleToPromRule';
import { type GrafanaRuleWithOrigin } from './useFilteredRulesIterator';
import { type K8sRuleFilter } from './useK8sFolderRules';

const RULE_PAGE_SIZE = 24;

export interface UseK8sFolderSearchRulesResult {
  rules: GrafanaRuleWithOrigin[];
  loadedCount: number;
  hasMore: boolean;
  isLoading: boolean;
  isInitialLoading: boolean;
  loadMore: () => void;
  error: unknown;
  /** "24+" while a continue token exists, the exact count once exhausted. */
  countLabel: string;
}

/**
 * Loads a folder's rules from the single cross-kind k8s `/search` endpoint (one request for
 * both alert + recording rules), with cursor pagination.
 */
export function useK8sFolderSearchRules(
  folderUid: string,
  folderTitle: string,
  groupFilter?: string,
  ruleFilter?: K8sRuleFilter,
  // When true, request `sort=group` so rules of the same group arrive contiguously (Option 1).
  sortByGroup = false
): UseK8sFolderSearchRulesResult {
  const [triggerSearch] = useLazyGetSearchRulesQuery();

  const [rules, setRules] = useState<GrafanaRuleWithOrigin[]>([]);
  const [continueToken, setContinueToken] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown>(undefined);
  const didInit = useRef(false);

  const baseArgs = buildFolderSearchArgs(folderUid, groupFilter, ruleFilter, sortByGroup);

  const fetchPage = useCallback(
    async (token: string | undefined) => {
      setIsLoading(true);
      setError(undefined);
      try {
        const args = { ...baseArgs, limit: String(RULE_PAGE_SIZE), continueToken: token };
        const response = await triggerSearch(args).unwrap();
        // The cross-kind `/search` response items are typed `any`; they match the hit union.
        const hits: RuleSearchHit[] = response.items ?? [];
        const next = response.metadata?.continue;
        setRules((current) => current.concat(hits.map((hit) => mapHit(hit, folderTitle))));
        setContinueToken(next);
        setHasMore(Boolean(next));
      } catch (err) {
        setError(err);
      } finally {
        setIsLoading(false);
      }
    },
    // baseArgs is derived from the same inputs as the reset effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [triggerSearch, folderTitle, folderUid, groupFilter, ruleFilter, sortByGroup]
  );

  // Reset + eager first page whenever the folder or filter changes.
  useEffect(() => {
    didInit.current = false;
    setRules([]);
    setContinueToken(undefined);
    setHasMore(false);
    if (didInit.current) {
      return;
    }
    didInit.current = true;
    fetchPage(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderUid, groupFilter, ruleFilter, sortByGroup]);

  const loadMore = useCallback(() => {
    if (!hasMore || isLoading) {
      return;
    }
    fetchPage(continueToken);
  }, [hasMore, isLoading, continueToken, fetchPage]);

  return {
    rules,
    loadedCount: rules.length,
    hasMore,
    isLoading,
    isInitialLoading: isLoading && rules.length === 0,
    loadMore,
    error,
    countLabel: hasMore ? `${rules.length}+` : `${rules.length}`,
  };
}

function mapHit(hit: RuleSearchHit, folderTitle: string): GrafanaRuleWithOrigin {
  return {
    rule: mapRuleHitToDTO(hit),
    groupIdentifier: {
      namespace: { uid: hit.folder },
      groupName: hit.group ?? '',
      groupOrigin: 'grafana',
    },
    namespaceName: folderTitle,
    origin: 'grafana',
    interval: hit.interval,
  };
}

function buildFolderSearchArgs(
  folderUid: string,
  groupFilter?: string,
  ruleFilter?: K8sRuleFilter,
  sortByGroup = false
): GetSearchRulesApiArg {
  // Single-value filters here, so the generated `string`-typed args fit without coercion.
  const args: GetSearchRulesApiArg = { folders: folderUid, sort: sortByGroup ? 'group' : 'title' };

  if (groupFilter?.trim()) {
    args.groups = groupFilter.trim();
  }
  if (ruleFilter?.ruleName?.trim()) {
    args.q = ruleFilter.ruleName.trim();
  }
  if (ruleFilter?.ruleType) {
    args.type = ruleFilter.ruleType === PromRuleType.Recording ? 'recordingrule' : 'alertrule';
  }
  if (ruleFilter?.dashboardUid) {
    args.dashboardUid = ruleFilter.dashboardUid;
  }
  if (ruleFilter?.contactPoint) {
    args.receiver = ruleFilter.contactPoint;
  }

  return args;
}
