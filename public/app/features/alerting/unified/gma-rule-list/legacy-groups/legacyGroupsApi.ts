import { generatedAPI as folderAPI } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { type GrafanaPromRuleGroupDTO, type GrafanaPromRulesResponse } from 'app/types/unified-alerting-dto';

import { alertingApi } from '../../api/alertingApi';
import { isUngroupedRuleGroup } from '../../utils/rules';

export { legacyGroupsAPI, useLegacyGroupsListingInfiniteQuery, useFindSubfolderQuery, splitFolderPath };

/** Server-side filters; an empty string means no filter. */
export interface LegacyGroupsListingArg {
  /** Words matched in order against group names, ignoring case. */
  groupName: string;
  /** Words matched in order against folder full paths, ignoring case. */
  folder: string;
}

export interface LegacyGroupsPage {
  groups: GrafanaPromRuleGroupDTO[];
  nextToken?: string;
}

// About 5 MB per page in compact mode, so every stack below this size loads in one request.
const RULES_PER_PAGE = 5000;

/**
 * Every evaluation group in the stack, from the only API that pages by group.
 * shortcut: reads the legacy rule tables, so only correct on legacy storage; remove the tab or move it to a
 * group-aware route before the Unified Storage cutover.
 */
const legacyGroupsAPI = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    legacyGroupsListing: build.infiniteQuery<LegacyGroupsPage, LegacyGroupsListingArg, string | undefined>({
      infiniteQueryOptions: {
        initialPageParam: undefined,
        getNextPageParam: (lastPage) => lastPage.nextToken || undefined,
      },
      keepUnusedDataFor: 0,
      query: ({ queryArg, pageParam }) => ({
        url: 'api/prometheus/grafana/api/v1/rules',
        params: {
          rule_limit: RULES_PER_PAGE,
          group_next_token: pageParam,
          compact: true,
          limit_alerts: 0,
          'search.rule_group': queryArg.groupName || undefined,
          'search.folder': queryArg.folder || undefined,
        },
      }),
      // shortcut: ungrouped rules arrive as placeholder groups and are dropped here; a server-side RuleGroupExists filter would skip them.
      transformResponse: (response: GrafanaPromRulesResponse): LegacyGroupsPage => ({
        groups: response.data.groups.filter((group) => !isUngroupedRuleGroup(group.name)),
        nextToken: response.data.groupNextToken,
      }),
    }),
  }),
});

const subfolderAPI = folderAPI.injectEndpoints({
  endpoints: (build) => ({
    /** The UID of a folder in `parentUid` titled exactly `title`, or null. Titles are not unique, so it takes the first. */
    findSubfolder: build.query<string | null, { parentUid: string; title: string }>({
      query: ({ parentUid, title }) => ({
        url: '/folders/search',
        method: 'POST',
        body: {
          apiVersion: 'search.grafana.app/v0alpha1',
          kind: 'SearchQuery',
          where: {
            and: [
              { filter: { field: 'folder', operator: 'In', values: [parentUid] } },
              { filter: { field: 'title', operator: 'In', values: [title] } },
            ],
          },
          limit: 1,
        },
      }),
      transformResponse: (response: { items?: Array<{ resource?: { name?: string } }> }) =>
        response.items?.[0]?.resource?.name ?? null,
      keepUnusedDataFor: 0,
    }),
  }),
});

/** Splits a group's `file`, the folder's full path, into titles; the inverse of `stringifyFolder` (`\\` and `\/` are escapes). */
function splitFolderPath(file: string): string[] {
  const titles = file.match(/(?:\\[\\/]|[^/])+/g) ?? [];
  return titles.map((title) => title.replace(/\\([\\/])/g, '$1'));
}

const { useLegacyGroupsListingInfiniteQuery } = legacyGroupsAPI;
const { useFindSubfolderQuery } = subfolderAPI;
