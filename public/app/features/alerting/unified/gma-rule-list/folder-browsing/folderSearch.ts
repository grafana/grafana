import {
  type ResultItem as FolderResultItem,
  type ListFolderSearchV1Beta1ApiResponse,
  generatedAPI as folderAPI,
} from '@grafana/api-clients/rtkq/folder/v1beta1';

import { buildFolderListSearchQuery } from './folderSearchQuery';

export interface FolderHit {
  uid: string;
  title: string;
}

export interface FolderSearchPage {
  folders: FolderHit[];
  continueToken?: string;
}

// Same tag the folder API's own list and delete endpoints use, so deleting a folder elsewhere
// refreshes this listing too.
const folderListTag = { type: 'Folder' as const, id: 'LIST' };

/**
 * The single place that names the folder search endpoint. The generated operation is a mutation
 * (it is a POST), so it provides no tags and has no page state; this injects the same request as
 * an infinite query keyed by the folder filter, with continuation tokens as the page parameters.
 */
export const folderSearchAPI = folderAPI.injectEndpoints({
  endpoints: (build) => ({
    searchRuleFolders: build.infiniteQuery<FolderSearchPage, { folderUids: string[] }, string | undefined>({
      infiniteQueryOptions: {
        initialPageParam: undefined,
        getNextPageParam: (lastPage) => lastPage.continueToken || undefined,
      },
      // Results are a view of the current page only; leaving it drops them.
      keepUnusedDataFor: 0,
      query: ({ queryArg, pageParam }) => ({
        url: '/folders/search',
        method: 'POST',
        body: buildFolderListSearchQuery(pageParam, queryArg.folderUids),
      }),
      transformResponse: (response: ListFolderSearchV1Beta1ApiResponse): FolderSearchPage => ({
        folders: response.items.map(toFolderHit),
        continueToken: response.metadata.continue,
      }),
      providesTags: [folderListTag],
    }),
  }),
});

export const { useSearchRuleFoldersInfiniteQuery } = folderSearchAPI;

function toFolderHit(item: FolderResultItem): FolderHit {
  return {
    uid: item.resource.name,
    title: typeof item.fields?.title === 'string' ? item.fields.title : item.resource.name,
  };
}
