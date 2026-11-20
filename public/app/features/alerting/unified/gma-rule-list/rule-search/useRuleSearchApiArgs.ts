import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import { useListFolderSearchV1Beta1Query } from '@grafana/api-clients/rtkq/folder/v1beta1';

import { buildFolderListSearchQuery } from '../folder-browsing/folderSearchQuery';
import { type RuleKind } from '../shared/ruleKind';
import { type useRuleSearchResult } from '../shared/ruleSearchPage';

import { type RuleSearchApiArgs, type SharedRuleFilter } from './sharedRuleFilter';

/**
 * `apiArgs` is undefined while there is nothing to search: skipped, looking the name up, lookup failed, or no folder
 * matched, since an empty UID list would search every folder.
 */
export function useRuleSearchApiArgs<Filter extends SharedRuleFilter>(
  kind: RuleKind,
  filter: Filter,
  { skip = false }: { skip?: boolean } = {}
) {
  const lookUp = !skip && filter.folder !== undefined;
  const folderLookup = useListFolderSearchV1Beta1Query(
    lookUp
      ? {
          searchQuery: {
            ...buildFolderListSearchQuery(kind, undefined, filter),
            limit: FOLDER_NAME_LOOKUP_LIMIT,
          },
        }
      : skipToken
  );
  const lookupResult = folderLookup.currentData;
  const lookedUpUids = useMemo(() => lookupResult?.items.map((item) => item.resource.name), [lookupResult]);

  const apiArgs = useMemo((): RuleSearchApiArgs<Filter> | undefined => {
    if (skip) {
      return undefined;
    }
    if (filter.folder === undefined) {
      return { filter, folderUids: filter.folderUids };
    }
    return lookedUpUids?.length ? { filter, folderUids: lookedUpUids } : undefined;
  }, [skip, filter, lookedUpUids]);

  return {
    apiArgs,
    folderLimitReached: lookUp && Boolean(lookupResult?.metadata.continue),
    isLookingUp: lookUp && !lookedUpUids && !folderLookup.isError,
    lookupError: folderLookup.isError ? folderLookup.error : undefined,
    retryLookup: () => {
      void folderLookup.refetch();
    },
    noMatchingFolder: lookedUpUids?.length === 0,
  };
}

export function withFolderLookup<Hit>(
  lookup: ReturnType<typeof useRuleSearchApiArgs>,
  result: ReturnType<typeof useRuleSearchResult<Hit, unknown>>
) {
  return {
    ...result,
    noMatchingFolder: lookup.noMatchingFolder,
    folderLimitReached: lookup.folderLimitReached,
    // `useRuleSearchResult` reports a skipped search as loading.
    isLoading: lookup.isLookingUp || (lookup.apiArgs !== undefined && result.isLoading),
    error: lookup.lookupError ?? result.error,
    retry: lookup.lookupError ? lookup.retryLookup : result.retry,
  };
}

// The search API returns at most 500 items per request.
export const FOLDER_NAME_LOOKUP_LIMIT = 500;
