import React from 'react';
import { v4 as uuidv4 } from 'uuid';

import { t } from '@grafana/i18n';
import { FetchError, isFetchError } from '@grafana/runtime';
import { AppNotificationSeverity } from 'app/types';


import { notifyApp } from '../../../../core/actions';
import { createSuccessNotification, createErrorNotification } from '../../../../core/copy/appNotification';
import { PullRequestLink } from '../../../../features/dashboard-scene/saving/provisioned/PullRequestLink';
import { createOnCacheEntryAdded } from '../utils/createOnCacheEntryAdded';

import {
  generatedAPI,
  JobSpec,
  JobStatus,
  RepositorySpec,
  RepositoryStatus,
  ErrorDetails,
  GetRepositoryRefsApiResponse,
} from './endpoints.gen';

function isFetchBaseQueryError(error: unknown): error is { error: FetchError } {
  return typeof error === 'object' && error != null && 'error' in error;
}

function createPRLinkComponent(url: string) {
  return React.createElement(PullRequestLink, { url });
}

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
      },
    },
    getRepositoryDiff: {
      onQueryStarted: async (_, { queryFulfilled, dispatch }) => {
        try {
          await queryFulfilled;
        } catch (e) {
          if (isFetchBaseQueryError(e)) {
            dispatch(
              notifyApp(
                createErrorNotification(
                  'Error getting repository diff',
                  isFetchBaseQueryError(e) ? e.error.data.message : 'Unknown error'
                )
              )
            );
          } else {
            dispatch(notifyApp(createErrorNotification('Error getting repository diff')));
          }
        }
      },
    },
    createRepositoryPr: {
      onQueryStarted: async (_, { queryFulfilled, dispatch }) => {
        try {
          const result = await queryFulfilled;
          const prUrl = result.data?.pullRequest?.url;
          dispatch(
            notifyApp({
              severity: AppNotificationSeverity.Success,
              icon: 'check',
              title: 'Pull request successfully created',
              text: '',
              component: prUrl ? createPRLinkComponent(prUrl) : undefined,
              id: uuidv4(),
              timestamp: Date.now(),
              showing: true,
            })
          );
        } catch (e) {
          dispatch(
            notifyApp(
              createErrorNotification(
                'Error creating pull request',
                isFetchBaseQueryError(e) ? e.error.data.message : 'Unknown error'
              )
            )
          );
        }
      },
    },
    getRepositoryRefs: {
      transformResponse: async (response: GetRepositoryRefsApiResponse) => {
        console.log('response', response);
        const orderedList = [...response.items].sort((a, b) => {
          // Put "master" or "main" first
          const aIsPrimary = a.name === 'master' || a.name === 'main';
          const bIsPrimary = b.name === 'master' || b.name === 'main';

          if (aIsPrimary && !bIsPrimary) {
            return -1;
          }
          if (!aIsPrimary && bIsPrimary) {
            return 1;
          }

          return 0;
        });

        return { ...response, items: orderedList };
      },
    },
  },
});

// eslint-disable-next-line no-barrel-files/no-barrel-files
export * from './endpoints.gen';
