import { t } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';

import { notifyApp } from '../../../../core/actions';
import { createSuccessNotification, createErrorNotification } from '../../../../core/copy/appNotification';
import { PAGE_SIZE } from '../../../../features/browse-dashboards/api/services';
import { refetchChildren } from '../../../../features/browse-dashboards/state/actions';
import { createOnCacheEntryAdded } from '../utils/createOnCacheEntryAdded';

import {
  generatedAPI,
  JobSpec,
  JobStatus,
  RepositorySpec,
  RepositoryStatus,
  ErrorDetails,
  Status,
} from './endpoints.gen';

export const provisioningAPIv0alpha1 = generatedAPI.enhanceEndpoints({
  endpoints: {
    listJob: {
      // Do not include 'watch' in the first query, so we can get the initial list of jobs
      // and then start watching for changes
      query: ({ watch, ...queryArg }) => ({
        url: `/jobs`,
        params: queryArg,
      }),
      onCacheEntryAdded: createOnCacheEntryAdded<JobSpec, JobStatus>('jobs'),
    },
    listRepository: {
      query: ({ watch, ...queryArg }) => ({
        url: `/repositories`,
        params: queryArg,
      }),
      onCacheEntryAdded: createOnCacheEntryAdded<RepositorySpec, RepositoryStatus>('repositories'),
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
          if (e instanceof Error) {
            dispatch(
              notifyApp(
                createErrorNotification(
                  t('provisioning.delete-repository-button.error-repository-delete', 'Failed to delete repository'),
                  e
                )
              )
            );
          }
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
          if (e instanceof Error) {
            dispatch(
              notifyApp(
                createErrorNotification(
                  t('provisioning.home-page.error-delete-all-repositories', 'Failed to delete all repositories'),
                  e
                )
              )
            );
          }
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
          if (!e) {
            dispatch(notifyApp(createErrorNotification('Error validating repository', new Error('Unknown error'))));
          } else if (e instanceof Error) {
            dispatch(notifyApp(createErrorNotification('Error validating repository', e)));
          } else if (typeof e === 'object' && 'error' in e && isFetchError(e.error)) {
            // Handle Status error responses (Kubernetes style)
            if (e.error.data.kind === 'Status' && e.error.data.status === 'Failure') {
              const statusError: Status = e.error.data;
              dispatch(
                notifyApp(
                  createErrorNotification(
                    'Error validating repository',
                    new Error(statusError.message || 'Unknown error')
                  )
                )
              );
            }
            // Handle TestResults error responses with field errors
            else if (Array.isArray(e.error.data.errors) && e.error.data.errors.length) {
              const nonFieldErrors = e.error.data.errors.filter((err: ErrorDetails) => !err.field);
              // Only show notification if there are errors that don't have a field, field errors are handled by the form
              if (nonFieldErrors.length > 0) {
                dispatch(notifyApp(createErrorNotification('Error validating repository')));
              }
            }
          }
        }
      },
    },
    createRepositoryJobs: {
      onQueryStarted: async (_, { queryFulfilled, dispatch }) => {
        try {
          await queryFulfilled;
          dispatch(
            notifyApp(createSuccessNotification(t('provisioning.sync-repository.success-pull-started', 'Pull started')))
          );
        } catch (e) {
          if (e instanceof Error) {
            dispatch(
              notifyApp(
                createErrorNotification(
                  t('provisioning.sync-repository.error-pulling-resources', 'Error pulling resources'),
                  e
                )
              )
            );
          }
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
          if (e instanceof Error) {
            dispatch(
              notifyApp(
                createErrorNotification(
                  t('provisioning.config-form.error-save-repository', 'Failed to save repository settings'),
                  e
                )
              )
            );
          }
        }
      },
    },
    replaceRepository: {
      onQueryStarted: async (_, { queryFulfilled, dispatch }) => {
        try {
          await queryFulfilled;
          dispatch(
            notifyApp(
              createSuccessNotification(
                t('provisioning.config-form.alert-repository-settings-updated', 'Repository settings updated')
              )
            )
          );
        } catch (e) {
          if (e instanceof Error) {
            dispatch(
              notifyApp(
                createErrorNotification(
                  t('provisioning.config-form.error-save-repository', 'Failed to save repository settings'),
                  e
                )
              )
            );
          }
        }
        // Refetch dashboards and folders after creating/updating a provisioned repository
        dispatch(refetchChildren({ parentUID: undefined, pageSize: PAGE_SIZE }));
      },
    },
  },
});

// eslint-disable-next-line no-barrel-files/no-barrel-files
export * from './endpoints.gen';
