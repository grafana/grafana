import { useRef, useState } from 'react';

import { useDeleteCorrelationMutation } from '@grafana/api-clients/rtkq/correlations/v0alpha1';
import { config, CorrelationsData } from '@grafana/runtime';

import CorrelationsPage from './CorrelationsPage';
import { RemoveCorrelationParams } from './types';
import { useCorrelations } from './useCorrelations';
import { useCorrelationsK8s } from './useCorrelationsK8s';

function CorrelationsPageLegacy() {
  const { remove, get } = useCorrelations();
  return (
    <CorrelationsPage
      fetchCorrelations={get.execute}
      correlations={get.value}
      isLoading={get.loading}
      error={get.error}
      removeFn={remove.execute}
    />
  );
}

function CorrelationsPageAppPlatform() {
  const [page, setPage] = useState(1);
  let totalItems = useRef(0);
  const limit = 100;
  const { currentData, isLoading, error, remainingItems } = useCorrelationsK8s(limit, page);
  const [deleteCorrelation] = useDeleteCorrelationMutation();
  if (page === 1) {
    totalItems.current = remainingItems;
  }

  // we cant do a straight refetch, we have to pass in new pages if necessary
  const enhRefetch = (): Promise<CorrelationsData> => {
    return new Promise(() => currentData);
  };

  return (
    <CorrelationsPage
      fetchCorrelations={enhRefetch}
      changePageFn={(toPage) => {
        setPage(toPage);
      }}
      correlations={{
        correlations: currentData,
        page: 0,
        limit: limit,
        totalCount: totalItems.current,
      }}
      isLoading={isLoading}
      error={error as Error}
      removeFn={(params: RemoveCorrelationParams) => {
        const deleteData = deleteCorrelation({ name: params.uid });
        return deleteData.unwrap();
      }}
    />
  );
}

export default function CorrelationsPageWrapper() {
  if (config.featureToggles.kubernetesCorrelations) {
    return <CorrelationsPageAppPlatform />;
  }

  return <CorrelationsPageLegacy />;
}
