import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import { useListFolderSearchV1Beta1Query } from '@grafana/api-clients/rtkq/folder/v1beta1';

import { buildFolderListSearchQuery } from '../folder-browsing/folderSearchQuery';

import { type RuleSearchApiArgs, type SharedRuleFilter } from './sharedRuleFilter';

/**
 * `apiArgs` stays undefined until there is a rule search to send: when skipped, while the names are looked up, when
 * the lookup fails, and when no folder has those names, since an empty UID list would search every folder.
 * `inFolderUid` skips the lookup: a Folders mode row knows its folder's UID, and its name could match same-named
 * folders.
 */
export function useRuleSearchApiArgs<Filter extends SharedRuleFilter>(
  filter: Filter,
  { skip = false, inFolderUid }: { skip?: boolean; inFolderUid?: string } = {}
) {
  const lookUp = !skip && !inFolderUid && filter.folders.length > 0;
  const folderLookup = useListFolderSearchV1Beta1Query(
    lookUp
      ? { searchQuery: { ...buildFolderListSearchQuery(undefined, filter.folders), limit: FOLDER_NAME_LOOKUP_LIMIT } }
      : skipToken
  );
  const lookupResult = folderLookup.currentData;
  const lookedUpUids = useMemo(() => lookupResult?.items.map((item) => item.resource.name), [lookupResult]);

  const apiArgs = useMemo((): RuleSearchApiArgs<Filter> | undefined => {
    if (skip) {
      return undefined;
    }
    if (inFolderUid) {
      return { filter, folderUids: [inFolderUid] };
    }
    if (filter.folders.length === 0) {
      return { filter, folderUids: [] };
    }
    return lookedUpUids?.length ? { filter, folderUids: lookedUpUids } : undefined;
  }, [skip, inFolderUid, filter, lookedUpUids]);

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

// The search API returns at most 500 items per request.
export const FOLDER_NAME_LOOKUP_LIMIT = 500;
