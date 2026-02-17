import { useDebounce } from 'react-use';

import { Job, useGetRepositoryJobsQuery, useListJobQuery } from 'app/api/clients/provisioning/v0alpha1';

interface RepositoryHistoricalJobsArgs {
  /** Limits the returned jobs to those which apply to this repository. */
  repositoryName: string;
}

function labelSelectorActive(repositoryName?: string): string | undefined {
  return repositoryName ? `provisioning.grafana.app/repository=${repositoryName}` : undefined;
}

// SPIKE: fake warning job to simulate a pull that found missing folder metadata
function createFakeWarningJob(repositoryName: string): Job {
  const now = Date.now();
  return {
    metadata: {
      name: 'fake-warning-job-metadata',
      uid: 'spike-fake-warning-job',
      creationTimestamp: new Date(now - 60000).toISOString(),
    },
    spec: {
      action: 'pull',
      repository: repositoryName,
      pull: { incremental: true },
    },
    status: {
      state: 'warning',
      started: now - 60000,
      finished: now - 55000,
      message: 'Completed with warnings: 2 folders missing .folder.json metadata files',
      warnings: [
        'Folder "dashboards/team-a" is missing .folder.json — folder UID will be auto-generated and may change on next sync',
        'Folder "dashboards/team-b" is missing .folder.json — permissions set on this folder may be lost',
      ],
      summary: [
        {
          group: 'folder.grafana.app',
          kind: 'Folder',
          total: 5,
          create: 0,
          update: 3,
          noop: 0,
          warning: 2,
          warnings: [
            'dashboards/team-a: missing .folder.json metadata file. Fix: /provisioning/' +
              repositoryName +
              '?tab=resources',
            'dashboards/team-b: missing .folder.json metadata file. Fix: /provisioning/' +
              repositoryName +
              '?tab=resources',
          ],
        },
        {
          group: 'dashboard.grafana.app',
          kind: 'Dashboard',
          total: 12,
          create: 2,
          update: 10,
          noop: 0,
        },
      ],
    },
  };
}

export function useRepositoryAllJobs({
  repositoryName,
}: RepositoryHistoricalJobsArgs): [
  Job[] | undefined,
  ReturnType<typeof useListJobQuery>,
  ReturnType<typeof useGetRepositoryJobsQuery>,
] {
  const activeQuery = useListJobQuery({
    labelSelector: labelSelectorActive(repositoryName),
    watch: true,
  });
  const historicQuery = useGetRepositoryJobsQuery({ name: repositoryName! });
  useDebounce(
    () => {
      historicQuery.refetch(); // fetch again when the watch value changes
    },
    250,
    [activeQuery.data]
  );

  const concatedItems = [...(activeQuery.data?.items ?? []), ...(historicQuery.data?.items ?? [])];

  // SPIKE: inject fake warning job
  concatedItems.push(createFakeWarningJob(repositoryName));

  const collator = new Intl.Collator(undefined, { numeric: true });
  const sortedItems = concatedItems.slice().sort((a, b) => {
    const aTime = a.metadata?.creationTimestamp ?? '';
    const bTime = b.metadata?.creationTimestamp ?? '';

    return collator.compare(bTime, aTime); // Reverse order for newest first
  });

  return [sortedItems, activeQuery, historicQuery];
}
