import * as z from 'zod';

import { generatedAPI as folderAPI } from '@grafana/api-clients/rtkq/folder/v1beta1';

import { buildFolderListSearchQuery } from './folderSearchQuery';

export { useSearchRuleFoldersInfiniteQuery };

interface FolderHit {
  uid: string;
  title: string;
}

interface FolderSearchPage {
  folders: FolderHit[];
  continueToken?: string;
}

const folderHitSchema = z
  .object({
    resource: z.object({ name: z.string() }),
    // A missing or malformed title falls back to the UID instead of failing the page.
    fields: z.object({ title: z.string().optional().catch(undefined) }).catch({}),
  })
  .transform(({ resource, fields }): FolderHit => ({ uid: resource.name, title: fields.title ?? resource.name }));

// Only what the listing reads.
const folderSearchResponseSchema = z.object({
  items: z.array(folderHitSchema),
  metadata: z.object({ continue: z.string().optional() }),
});

type FolderSearchResponse = z.infer<typeof folderSearchResponseSchema>;

/**
 * Infinite query keyed by folder filter, so a new filter starts again from the first page. The
 * generated search is a POST mutation with no tags or page state.
 */
const folderSearchAPI = folderAPI.injectEndpoints({
  endpoints: (build) => ({
    searchRuleFolders: build.infiniteQuery<FolderSearchPage, { folderUids: string[] }, string | undefined>({
      infiniteQueryOptions: {
        initialPageParam: undefined,
        getNextPageParam: (lastPage) => lastPage.continueToken || undefined,
      },
      // Results are a view of the current page only: leaving it drops them, and coming back searches again.
      keepUnusedDataFor: 0,
      query: ({ queryArg, pageParam }) => ({
        url: '/folders/search',
        method: 'POST',
        body: buildFolderListSearchQuery(pageParam, queryArg.folderUids),
      }),
      rawResponseSchema: folderSearchResponseSchema,
      // A response that fails the schema becomes a query error, so the page shows it with Retry.
      catchSchemaFailure: (error) => ({ message: error.message }),
      transformResponse: (response: FolderSearchResponse): FolderSearchPage => ({
        folders: response.items,
        continueToken: response.metadata.continue,
      }),
    }),
  }),
});

const { useSearchRuleFoldersInfiniteQuery } = folderSearchAPI;
