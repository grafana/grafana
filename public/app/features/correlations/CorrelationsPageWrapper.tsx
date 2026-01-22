import { useState } from 'react';

import { handleRequestError } from '@grafana/api-clients';
import { useDeleteCorrelationMutation } from '@grafana/api-clients/rtkq/correlations/v0alpha1';
import { config } from '@grafana/runtime';

import CorrelationsPage from './CorrelationsPage';
import { GetCorrelationsParams, RemoveCorrelationParams } from './types';
import { useCorrelations } from './useCorrelations';
import { useCorrelationsK8s } from './useCorrelationsK8s';

export function CorrelationsPageLegacy() {
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
  const limit = 100;
  const { currentData, isLoading, error, doesContinue } = useCorrelationsK8s(limit, page);
  const [deleteCorrelation] = useDeleteCorrelationMutation();

  // we cant do a straight refetch, we have to pass in new pages if necessary
  const enhRefetch = (params: GetCorrelationsParams) => {
    return { correlations: currentData, page: params.page, limit, totalCount: 0 };
  };

  const fmtedError = error ? handleRequestError(error) : undefined;

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
        totalCount: 0,
      }}
      isLoading={isLoading}
      error={fmtedError?.error}
      removeFn={(params: RemoveCorrelationParams) => {
        const deleteData = deleteCorrelation({ name: params.uid });
        return deleteData.unwrap();
      }}
      hasNextPage={doesContinue}
    />
  );
}

export default function CorrelationsPageWrapper() {
  if (config.featureToggles.kubernetesCorrelations) {
    return <CorrelationsPageAppPlatform />;
  }

  return <CorrelationsPageLegacy />;
}
