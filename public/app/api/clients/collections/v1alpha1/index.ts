import { generatedAPI } from '@grafana/api-clients/rtkq/collections/v1alpha1';
import { t } from '@grafana/i18n';
import { handleError } from 'app/api/utils';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';
import { type DashboardQueryResult } from 'app/features/search/service/types';

interface SearchStarredArgs {
  /** Starred dashboard uids. */
  dashboards: string[];
  /** Starred folder uids; empty while folders can't be starred. */
  folders: string[];
  /** Cap on the starred uids searched, in uid order. */
  limit: number;
}

interface StarredSearch {
  /** The starred uids the rows were searched for, deduped across kinds and capped. */
  uids: string[];
  rows: DashboardQueryResult[];
}

export const collectionsAPIv1alpha1 = generatedAPI
  .enhanceEndpoints({
    endpoints: {
      addStar: {
        onQueryStarted: async (_, { queryFulfilled, dispatch }) => {
          try {
            await queryFulfilled;
            dispatch(notifyApp(createSuccessNotification(t('dashboard.toolbar.star-added', 'Added to starred'))));
          } catch (e) {
            handleError(e, dispatch, t('dashboard.toolbar.star-add-error', 'Failed to add to starred'));
          }
        },
      },
      removeStar: {
        onQueryStarted: async (_, { queryFulfilled, dispatch }) => {
          try {
            await queryFulfilled;
            dispatch(notifyApp(createSuccessNotification(t('dashboard.toolbar.star-removed', 'Removed from starred'))));
          } catch (e) {
            handleError(e, dispatch, t('dashboard.toolbar.star-remove-error', 'Failed to remove from starred'));
          }
        },
      },
    },
  })
  .injectEndpoints({
    endpoints: (build) => ({
      /**
       * Starred items as search rows. The star set is the argument, so a changed set is a new cache entry: the
       * previous rows stay up as `data` while it loads, and a late answer for an old set can't overwrite it.
       */
      searchStarred: build.query<StarredSearch, SearchStarredArgs>({
        queryFn: async ({ dashboards, folders, limit }) => {
          // Deduped so a uid starred as both kinds is searched for, and listed, once.
          const uids = [...new Set([...dashboards, ...folders])].sort().slice(0, limit);
          if (uids.length === 0) {
            return { data: { uids, rows: [] } };
          }
          // The search matches the uid union against every kind asked for, so a uid starred as one kind must not
          // surface a row of the other: keep only kind-matching hits.
          const starredUidsByKind: Record<string, Set<string> | undefined> = {
            dashboard: new Set(dashboards),
            folder: new Set(folders),
          };
          try {
            // Lazy-imported to avoid a circular dependency: the searcher's unified implementation imports this
            // module for `listStars`.
            const { getGrafanaSearcher } = await import('app/features/search/service/searcher');
            const response = await getGrafanaSearcher().search({
              name: uids,
              kind: folders.length ? ['dashboard', 'folder'] : ['dashboard'],
            });
            const rows = response.view.toArray().filter((row) => starredUidsByKind[row.kind]?.has(row.uid));
            return { data: { uids, rows } };
          } catch (error) {
            return { error };
          }
        },
      }),
    }),
  });

export const { useSearchStarredQuery } = collectionsAPIv1alpha1;

// eslint-disable-next-line no-barrel-files/no-barrel-files
export * from '@grafana/api-clients/rtkq/collections/v1alpha1';
