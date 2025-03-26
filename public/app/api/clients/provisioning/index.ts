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
  HistoricJob,
  HistoricJobList,
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
    listHistoricJob(endpoint) {
      endpoint.query = ({ watch, ...queryArg }) => ({
        url: `/historicjobs`,
        params: queryArg,
      });
      endpoint.onCacheEntryAdded = createOnCacheEntryAdded<JobSpec, JobStatus, HistoricJob, HistoricJobList>(
        'historicjobs'
      );
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
  },
});

// eslint-disable-next-line no-barrel-files/no-barrel-files
export * from './endpoints.gen';
