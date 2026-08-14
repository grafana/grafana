import { skipToken } from '@reduxjs/toolkit/query/react';

import { useListJobQuery } from '../../api/clients/provisioning/v0alpha1';

export function useGetActiveJob(name?: string) {
  const activeQuery = useListJobQuery(
    name
      ? {
          labelSelector: `provisioning.grafana.app/repository=${name}`,
          watch: true,
        }
      : skipToken
  );
  const items = activeQuery?.data?.items;
  return items?.find((j) => j.status?.state === 'working') ?? items?.[0];
}
