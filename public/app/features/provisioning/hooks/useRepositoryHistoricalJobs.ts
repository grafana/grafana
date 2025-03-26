import { HistoricJob, useListHistoricJobQuery } from 'app/api/clients/provisioning';

interface RepositoryHistoricalJobsArgs {
  /** Limits the returned jobs to those which had this name before archival. */
  originalJobName?: string;
  /** Limits the returned jobs to those which apply to this repository. */
  repositoryName?: string;
  /** Whether to continue receiving more updates of the current historic jobs (i.e. if more come in; existing ones are immutable but may be deleted). */
  watch?: boolean;
}

function labelSelectors({
  originalJobName,
  repositoryName,
}: Pick<RepositoryHistoricalJobsArgs, 'originalJobName' | 'repositoryName'>): string | undefined {
  const repoName = repositoryName ? `provisioning.grafana.app/repository=${repositoryName}` : '';
  const originalName = originalJobName ? `provisioning.grafana.app/original-name=${originalJobName}` : '';

  const selector = [repoName, originalName].filter(Boolean).join(', ');
  return !!selector ? selector : undefined;
}

export function useRepositoryHistoricalJobs(
  args: RepositoryHistoricalJobsArgs = {}
): [HistoricJob[] | undefined, ReturnType<typeof useListHistoricJobQuery>] {
  const query = useListHistoricJobQuery({ labelSelector: labelSelectors(args), watch: args.watch });

  const collator = new Intl.Collator(undefined, { numeric: true });
  const sortedItems = query.data?.items?.slice().sort((a, b) => {
    const aTime = a.metadata?.creationTimestamp ?? '';
    const bTime = b.metadata?.creationTimestamp ?? '';
    return collator.compare(bTime, aTime); // Reverse order for newest first
  });

  return [sortedItems, query];
}
