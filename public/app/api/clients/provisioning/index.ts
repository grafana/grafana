import { isFetchError } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { createSuccessNotification, createErrorNotification } from 'app/core/copy/appNotification';
import { t } from 'app/core/internationalization';

import {
  generatedAPI,
  JobSpec,
  JobStatus,
  RepositorySpec,
  RepositoryStatus,
  Job,
  JobList,
  Repository,
  RepositoryList,
} from './endpoints.gen';
import { createOnCacheEntryAdded } from './utils/createOnCacheEntryAdded';

export const provisioningAPI = generatedAPI.enhanceEndpoints({
  endpoints: {
    listJob: {
      // Do not include 'watch' in the first query, so we can get the initial list of jobs
      // and then start watching for changes
      query: ({ watch, ...queryArg }) => ({
        url: `/jobs`,
        params: queryArg,
      }),
      onCacheEntryAdded: createOnCacheEntryAdded<JobSpec, JobStatus, Job, JobList>('jobs'),
    },
    listRepository: {
      query: ({ watch, ...queryArg }) => ({
        url: `/repositories`,
        params: queryArg,
      }),
      onCacheEntryAdded: createOnCacheEntryAdded<RepositorySpec, RepositoryStatus, Repository, RepositoryList>(
        'repositories'
      ),
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
            if (Array.isArray(e.error.data.errors) && e.error.data.errors.length) {
              dispatch(
                notifyApp(createErrorNotification('Error validating repository', e.error.data.errors.join('\n')))
              );
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
      },
    },
  },
});

// eslint-disable-next-line no-barrel-files/no-barrel-files
export * from './endpoints.gen';
