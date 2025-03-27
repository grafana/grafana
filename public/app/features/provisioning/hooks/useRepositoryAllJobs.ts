import { HistoricJob, Job, useListHistoricJobQuery, useListJobQuery } from 'app/api/clients/provisioning';

interface RepositoryHistoricalJobsArgs {
  /** Limits the returned jobs to those which have this job name (max 1 active, unlimited historic). */
  jobName?: string;
  /** Limits the returned jobs to those which apply to this repository. */
  repositoryName?: string;
  /** Whether to continue receiving more updates of the current jobs. */
  watch?: boolean;
  /**
   * How to sort the resulting jobs.
   *
   * - `created-first`: All jobs are treated equally. The newest jobs are shown first.
   * - `active-first`: Active jobs are shown first, then historic jobs. Within each group, the newest jobs are shown first.
   */
  sort?: 'created-first' | 'active-first';
}

function labelSelectorActive(repositoryName?: string): string | undefined {
  return repositoryName ? `repository=${repositoryName}` : undefined;
}

function labelSelectorHistoric(repositoryName?: string, jobName?: string): string | undefined {
  const repoName = repositoryName ? `provisioning.grafana.app/repository=${repositoryName}` : '';
  const name = jobName ? `provisioning.grafana.app/original-name=${jobName}` : '';

  const selector = [repoName, name].filter(Boolean).join(', ');
  return !!selector ? selector : undefined;
}

function fieldSelectorActive(jobName?: string): string | undefined {
  return jobName ? `metadata.name=${jobName}` : undefined;
}

export function useRepositoryAllJobs({
  jobName,
  repositoryName,
  watch = true,
  sort = 'created-first',
}: RepositoryHistoricalJobsArgs = {}): [
  Array<Job | HistoricJob> | undefined,
  ReturnType<typeof useListJobQuery>,
  ReturnType<typeof useListHistoricJobQuery>,
] {
  const activeQuery = useListJobQuery({
    labelSelector: labelSelectorActive(repositoryName),
    fieldSelector: fieldSelectorActive(jobName),
    watch,
  });
  const historicQuery = useListHistoricJobQuery({ labelSelector: labelSelectorHistoric(), watch });

  const concatedItems = [...(activeQuery.data?.items ?? []), ...(historicQuery.data?.items ?? [])];
  const collator = new Intl.Collator(undefined, { numeric: true });
  const sortedItems = concatedItems.slice().sort((a, b) => {
    if (sort === 'active-first') {
      const aActive = a.kind === 'Job';
      const bActive = b.kind === 'Job';

      if (aActive && !bActive) {
        return -1;
      } else if (!aActive && bActive) {
        return 1;
      }
      // otherwise, both are active or both are historic. Sort by creation timestamp.
    }
    const aTime = a.metadata?.creationTimestamp ?? '';
    const bTime = b.metadata?.creationTimestamp ?? '';

    return collator.compare(bTime, aTime); // Reverse order for newest first
  });

  return [sortedItems, activeQuery, historicQuery];
}
