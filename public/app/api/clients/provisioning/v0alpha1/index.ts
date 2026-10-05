import {
  generatedAPI,
  type ConnectionSpec,
  type ConnectionStatus,
  type ErrorDetails,
  type JobSpec,
  type JobStatus,
  type RepositorySpec,
  type RepositoryStatus,
  type Status,
} from '@grafana/api-clients/rtkq/provisioning/v0alpha1';
import { t } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { clearFolders } from 'app/features/browse-dashboards/state/slice';
import { getState } from 'app/store/store';
import { type ThunkDispatch } from 'app/types/store';

import {
  createErrorNotification,
  createSuccessNotification,
  createWarningNotification,
} from '../../../../core/copy/appNotification';
import { notifyApp } from '../../../../core/reducers/appNotification';
import { PAGE_SIZE } from '../../../../features/browse-dashboards/api/constants';
import { refetchChildren } from '../../../../features/browse-dashboards/state/actions';
import { handleError } from '../../../utils';
import { compareResourceVersions, createOnCacheEntryAdded } from '../utils/createOnCacheEntryAdded';

const handleProvisioningFormError = (e: unknown, dispatch: ThunkDispatch, title: string) => {
  if (typeof e === 'object' && e && 'error' in e && isFetchError(e.error)) {
    if (e.error.data.kind === 'Status' && e.error.data.status === 'Failure') {
      const statusError: Status = e.error.data;
      dispatch(notifyApp(createErrorNotification(title, new Error(statusError.message || 'Unknown error'))));
      return;
    }

    if (Array.isArray(e.error.data.errors) && e.error.data.errors.length) {
      const nonFieldErrors = e.error.data.errors.filter((err: ErrorDetails) => !err.field);
      if (nonFieldErrors.length > 0) {
        dispatch(notifyApp(createErrorNotification(title)));
      }
      return;
    }
  }

  handleError(e, dispatch, title);
};

export const provisioningAPIv0alpha1 = generatedAPI.enhanceEndpoints({
  endpoints: {
    listJob: {
      // Do not include 'watch' in the first query, so we can get the initial list of jobs
      // and then start watching for changes
      query: ({ watch, ...queryArg }) => ({
        url: `/jobs`,
        params: queryArg,
      }),
      onCacheEntryAdded: createOnCacheEntryAdded<JobSpec, JobStatus>('jobs', {
        // The listJob query is always scoped to a single job via fieldSelector,
        // so items will contain at most one entry. If items is empty, there's no
        // cached job to update — activeJob is already undefined, so the existing
        // FinishedJobStatus fallback handles it. We only need to set the error
        // status when there IS a cached job that would otherwise appear stuck.
        onError: (error, updateCachedData) => {
          updateCachedData((draft) => {
            if (draft.items?.[0]) {
              draft.items[0].status = {
                ...draft.items[0].status,
                state: 'error',
                message: String(error),
              };
            }
          });
        },
      }),
    },
    listRepository: {
      query: ({ watch, ...queryArg }) => ({
        url: `/repositories`,
        params: queryArg,
      }),
      // A refetch can carry a snapshot the server read before a mutation whose response is
      // already in the cache (a list GET fired by the pre-save connection test can fulfil after
      // the PUT). Membership and list metadata follow the response; per item, keep the cached
      // object when its resourceVersion is the same or newer.
      merge: (draft, response) => {
        const cached = new Map((draft.items ?? []).map((item) => [item.metadata?.name, item]));
        draft.items = (response.items ?? []).map((item) => {
          const existing = cached.get(item.metadata?.name);
          const cmp = compareResourceVersions(item.metadata?.resourceVersion, existing?.metadata?.resourceVersion);
          return existing && cmp !== null && cmp <= 0 ? existing : item;
        });
        draft.metadata = response.metadata;
      },
      onCacheEntryAdded: createOnCacheEntryAdded<RepositorySpec, RepositoryStatus>('repositories', {
        onError: (_error, _updateCachedData, dispatch) => {
          dispatch(
            notifyApp(
              createWarningNotification(
                t('provisioning.watch-stream.error-title', 'Live updates unavailable'),
                t(
                  'provisioning.watch-stream.error-description',
                  'Real-time updates could not be started. Refresh the page to see the latest data.'
                )
              )
            )
          );
        },
      }),
    },
    listConnection: {
      query: ({ watch, ...queryArg }) => ({
        url: `/connections`,
        params: queryArg,
      }),
      onCacheEntryAdded: createOnCacheEntryAdded<ConnectionSpec, ConnectionStatus>('connections', {
        onError: (_error, _updateCachedData, dispatch) => {
          dispatch(
            notifyApp(
              createWarningNotification(
                t('provisioning.watch-stream.error-title', 'Live updates unavailable'),
                t(
                  'provisioning.watch-stream.error-description',
                  'Real-time updates could not be started. Refresh the page to see the latest data.'
                )
              )
            )
          );
        },
      }),
      providesTags: (result) =>
        result
          ? [
              { type: 'Connection', id: 'LIST' },
              ...result.items
                .map((connection) => ({ type: 'Connection' as const, id: connection.metadata?.name }))
                .filter(Boolean),
            ]
          : [{ type: 'Connection', id: 'LIST' }],
    },
    deleteRepository: {
      onQueryStarted: async (_, { queryFulfilled, dispatch }) => {
        try {
          await queryFulfilled;
          dispatch(
            notifyApp(
              createSuccessNotification(
                t(
                  'provisioning.delete-repository-button.success-repository-deleted',
                  'Repository settings queued for deletion'
                )
              )
            )
          );
        } catch (e) {
          handleError(
            e,
            dispatch,
            t('provisioning.delete-repository-button.error-repository-delete', 'Failed to delete repository')
          );
        }
        // Refetch dashboards and folders after deleting a provisioned repository.
        // We need to add timeout to ensure that the deletion is processed before refetching since the deletion is done
        // via a background job.
        setTimeout(() => {
          dispatch(refetchChildren({ parentUID: undefined, pageSize: PAGE_SIZE }));
        }, 1000);
      },
    },
    deletecollectionRepository: {
      onQueryStarted: async (_, { queryFulfilled, dispatch }) => {
        try {
          await queryFulfilled;
          dispatch(
            notifyApp(
              createSuccessNotification(
                t('provisioning.home-page.success-all-repositories-deleted', 'All configured repositories deleted')
              )
            )
          );
        } catch (e) {
          handleError(
            e,
            dispatch,
            t('provisioning.home-page.error-delete-all-repositories', 'Failed to delete all repositories')
          );
        }
        setTimeout(() => {
          dispatch(refetchChildren({ parentUID: undefined, pageSize: PAGE_SIZE }));
        }, 1000);
      },
    },
    createRepositoryTest: {
      onQueryStarted: async (_, { queryFulfilled, dispatch }) => {
        try {
          await queryFulfilled;
        } catch (e) {
          handleProvisioningFormError(e, dispatch, 'Error validating repository');
        }
      },
    },
    createRepositoryJobs: {
      onQueryStarted: async ({ jobSpec }, { queryFulfilled, dispatch }) => {
        try {
          await queryFulfilled;
          if (jobSpec.action === 'pull' || jobSpec.action === 'migrate') {
            dispatch(
              notifyApp(
                createSuccessNotification(t('provisioning.sync-repository.success-pull-started', 'Pull started'))
              )
            );
          }
        } catch (e) {
          handleError(
            e,
            dispatch,
            t('provisioning.sync-repository.error-pulling-resources', 'Error pulling resources')
          );
        }
      },
    },
    createRepository: {
      onQueryStarted: async (_, { queryFulfilled, dispatch }) => {
        try {
          await queryFulfilled;
          dispatch(
            notifyApp(
              createSuccessNotification(
                t('provisioning.config-form.alert-repository-settings-saved', 'Repository settings saved')
              )
            )
          );
        } catch (e) {
          handleError(
            e,
            dispatch,
            t('provisioning.config-form.error-save-repository', 'Failed to save repository settings')
          );
        }
      },
    },
    replaceRepository: {
      onQueryStarted: async (_, { queryFulfilled, dispatch, getState }) => {
        try {
          const { data } = await queryFulfilled;
          // Until the invalidation refetch or watch event lands, cached lists still hold the
          // pre-update object, whose observedGeneration matches its old generation, so
          // readiness checks would briefly treat a just-edited repository as reconciled.
          for (const args of generatedAPI.util.selectCachedArgsForQuery(getState(), 'listRepository')) {
            dispatch(
              generatedAPI.util.updateQueryData('listRepository', args, (draft) => {
                const index = draft.items?.findIndex((item) => item.metadata?.name === data.metadata?.name) ?? -1;
                if (!draft.items || index === -1) {
                  return;
                }
                const cmp = compareResourceVersions(
                  data.metadata?.resourceVersion,
                  draft.items[index].metadata?.resourceVersion
                );
                if (cmp === null || cmp > 0) {
                  draft.items[index] = data;
                }
              })
            );
          }
          dispatch(
            notifyApp(
              createSuccessNotification(
                t('provisioning.config-form.alert-repository-settings-updated', 'Repository settings updated')
              )
            )
          );
        } catch (e) {
          handleError(
            e,
            dispatch,
            t('provisioning.config-form.error-save-repository', 'Failed to save repository settings')
          );
        }
        // Refetch dashboards and folders after creating/updating a provisioned repository
        dispatch(refetchChildren({ parentUID: undefined, pageSize: PAGE_SIZE }));
      },
    },
    getRepositoryJobsWithPath: {
      onQueryStarted: async (_, { queryFulfilled, dispatch }) => {
        try {
          const result = await queryFulfilled;
          const job = result.data;

          // Clear folder cache after successful move/delete jobs
          // We use clearFolders here to clear cached data and closes folders (immediate visual feedback)
          // Force a refetch of subfolders if user has opened them, so user see latest data
          if (job.status?.state === 'success' && (job.spec?.action === 'delete' || job.spec?.action === 'move')) {
            const state = getState().browseDashboards;
            const action = job.spec?.action;
            let childrenKeys = Object.keys(state.childrenByParentUID);

            if (action === 'delete') {
              // Do not clear deleted resources to avoid 404s when refetching them
              const deletedResourceNames =
                job.spec?.[action]?.resources?.map((resource) => resource.name).filter(Boolean) || [];
              childrenKeys = childrenKeys.filter((key) => !deletedResourceNames.includes(key));
            }
            dispatch(clearFolders(childrenKeys));
          }
        } catch (e) {
          console.error('Error in getRepositoryJobsWithPath:', e);
        }
      },
    },
    createConnection: {
      onQueryStarted: async (arg, { queryFulfilled, dispatch }) => {
        try {
          await queryFulfilled;
          // Only show success notification for actual saves, not dryRun validation
          if (!arg.dryRun) {
            dispatch(
              notifyApp(
                createSuccessNotification(t('provisioning.connection-form.alert-connection-saved', 'Connection saved'))
              )
            );
          }
        } catch (e) {
          handleProvisioningFormError(
            e,
            dispatch,
            t('provisioning.connection-form.error-save-connection', 'Failed to save connection')
          );
        }
      },
    },
    replaceConnection: {
      onQueryStarted: async (arg, { queryFulfilled, dispatch }) => {
        try {
          await queryFulfilled;
          // Only show success notification for actual saves, not dryRun validation
          if (!arg.dryRun) {
            dispatch(
              notifyApp(
                createSuccessNotification(
                  t('provisioning.connection-form.alert-connection-updated', 'Connection updated')
                )
              )
            );
          }
        } catch (e) {
          handleProvisioningFormError(
            e,
            dispatch,
            t('provisioning.connection-form.error-save-connection', 'Failed to save connection')
          );
        }
      },
    },
    deleteConnection: {
      invalidatesTags: (result, error) => (error ? [] : [{ type: 'Connection', id: 'LIST' }]),
      onQueryStarted: async (_, { queryFulfilled, dispatch }) => {
        try {
          await queryFulfilled;
          dispatch(
            notifyApp(
              createSuccessNotification(
                t('provisioning.connection-form.alert-connection-deleted', 'Connection deleted')
              )
            )
          );
        } catch (e) {
          handleError(
            e,
            dispatch,
            t('provisioning.connection-form.error-delete-connection', 'Failed to delete connection')
          );
        }
      },
    },
  },
});

// eslint-disable-next-line no-barrel-files/no-barrel-files
export * from '@grafana/api-clients/rtkq/provisioning/v0alpha1';
