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
    listJob(endpoint) {
      // Do not include 'watch' in the first query, so we can get the initial list of jobs
      // and then start watching for changes
      endpoint.query = ({ watch, ...queryArg }) => ({
        url: `/jobs`,
        params: queryArg,
      });
      endpoint.onCacheEntryAdded = createOnCacheEntryAdded<JobSpec, JobStatus, Job, JobList>('jobs');
    },
    listRepository(endpoint) {
      endpoint.query = ({ watch, ...queryArg }) => ({
        url: `/repositories`,
        params: queryArg,
      });
      endpoint.onCacheEntryAdded = createOnCacheEntryAdded<
        RepositorySpec,
        RepositoryStatus,
        Repository,
        RepositoryList
      >('repositories');
    },
    updateRepository(endpoint) {
      endpoint.query = (queryArg) => ({
        url: `/repositories/${queryArg.name}`,
        method: 'PATCH',
        headers: {
          'Content-Type': `application/json-patch+json`, // Or merge-patch
        },
        body: JSON.stringify(queryArg.patch),
        params: {
          pretty: queryArg.pretty,
          dryRun: queryArg.dryRun,
          fieldManager: queryArg.fieldManager,
          fieldValidation: queryArg.fieldValidation,
          force: queryArg.force,
        },
      });
    },
  },
});

// eslint-disable-next-line no-barrel-files/no-barrel-files
export * from './endpoints.gen';
