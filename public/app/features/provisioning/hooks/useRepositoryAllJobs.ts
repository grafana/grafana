import { HistoricJob, Job, useListHistoricJobQuery, useListJobQuery } from 'app/api/clients/provisioning';

interface RepositoryHistoricalJobsArgs {
  /** Limits the returned jobs to those which have this job name (max 1 active, unlimited historic). */
  jobName?: string;
  /** Limits the returned jobs to those which apply to this repository. */
  repositoryName?: string;
  /** Whether to continue receiving more updates of the current jobs. */
  watch?: boolean;
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

export function useRepositoryAllJobs({ jobName, repositoryName, watch = true }: RepositoryHistoricalJobsArgs = {}): [
  (Job | HistoricJob)[] | undefined,
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
    const aTime = a.metadata?.creationTimestamp ?? '';
    const bTime = b.metadata?.creationTimestamp ?? '';

    return collator.compare(bTime, aTime); // Reverse order for newest first
  });

  return [sortedItems, activeQuery, historicQuery];
}
