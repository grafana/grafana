import { useDebounce } from 'react-use';

import { Job, useGetRepositoryJobsQuery, useListJobQuery } from 'app/api/clients/provisioning/v0alpha1';

interface RepositoryHistoricalJobsArgs {
  /** Limits the returned jobs to those which apply to this repository. */
  repositoryName: string;
}

function labelSelectorActive(repositoryName?: string): string | undefined {
  return repositoryName ? `provisioning.grafana.app/repository=${repositoryName}` : undefined;
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
  const collator = new Intl.Collator(undefined, { numeric: true });
  const sortedItems = concatedItems.slice().sort((a, b) => {
    const aTime = a.metadata?.creationTimestamp ?? '';
    const bTime = b.metadata?.creationTimestamp ?? '';

    return collator.compare(bTime, aTime); // Reverse order for newest first
  });

  return [sortedItems, activeQuery, historicQuery];
}
