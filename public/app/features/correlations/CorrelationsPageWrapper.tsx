import { useRef, useState } from 'react';

import { config, CorrelationsData } from '@grafana/runtime';

import CorrelationsPage from './CorrelationsPage';
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
  // todo remove fake limit
  /* const { currentData, isLoading, error } = useListCorrelationQuery({ limit: 10 });
  const enrichedCorrelations = (correlations?: CorrelationList) => {
    return correlations !== undefined
      ? correlations.items.map((item) => toEnrichedCorrelationDataK8s(item)).filter((i) => i !== undefined)
      : [];
  }; */
  const [page, setPage] = useState(1);
  let totalItems = useRef(0);

  const limit = 10;
  const { currentData, isLoading, error, remainingItems } = useCorrelationsK8s(limit, page);
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
    />
  );
}

export default function CorrelationsPageWrapper() {
  if (config.featureToggles.kubernetesCorrelations) {
    return <CorrelationsPageAppPlatform />;
  }

  return <CorrelationsPageLegacy />;
}
