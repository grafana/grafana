import { useListRepositoryQuery } from './api';

export function useProvisioningConfig() {
  const query = useListRepositoryQuery();
  console.log('q', query);

  const sortedItems = query.data?.items?.slice().sort((a, b) => {
    return Number(b.metadata.resourceVersion) - Number(a.metadata.resourceVersion);
  });

  return [sortedItems?.[0], query.isLoading];
}
