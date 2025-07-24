import { skipToken } from '@reduxjs/toolkit/query/react';

import { Job, useListJobQuery } from 'app/api/clients/provisioning/v0alpha1';

interface RepositoryJobsArgs {
  name?: string;
  watch?: boolean;
}

export function useRepositoryJobs({ name, watch = true }: RepositoryJobsArgs = {}): [
  Job[] | undefined,
  ReturnType<typeof useListJobQuery>,
] {
  const query = useListJobQuery(
    name
      ? {
          labelSelector: `repository=${name}`,
          watch,
        }
      : skipToken
  );

  const collator = new Intl.Collator(undefined, { numeric: true });

  const sortedItems = query.data?.items?.slice().sort((a, b) => {
    const aTime = a.metadata?.creationTimestamp ?? '';
    const bTime = b.metadata?.creationTimestamp ?? '';
    return collator.compare(bTime, aTime); // Reverse order for newest first
  });

  return [sortedItems, query];
}
