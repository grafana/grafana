import { skipToken } from '@reduxjs/toolkit/query/react';

import { useListJobQuery } from '../../api/clients/provisioning/v0alpha1';

export function useGetActiveJob(name?: string) {
  const activeQuery = useListJobQuery(
    name
      ? {
          fieldSelector: `metadata.name=${name}`,
          watch: true,
        }
      : skipToken
  );
  return activeQuery?.data?.items?.[0];
}
