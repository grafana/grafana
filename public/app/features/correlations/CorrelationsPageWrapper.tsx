import { CorrelationList, useListCorrelationQuery } from '@grafana/api-clients/rtkq/correlations/v0alpha1';
import { config, CorrelationsData } from '@grafana/runtime';

import CorrelationsPage from './CorrelationsPage';
import { GetCorrelationsParams } from './types';
import { useCorrelations } from './useCorrelations';
import { toEnrichedCorrelationDataK8s } from './useCorrelationsK8s';

export default function CorrelationsPageWrapper() {
  // I cannot use these conditionally, is this okay?
  const { remove, get } = useCorrelations();
  const { currentData, isLoading, error } = useListCorrelationQuery({ limit: 10 });
  if (config.featureToggles.kubernetesCorrelations) {
    const enrichedCorrelations = (correlations?: CorrelationList) => {
      return correlations !== undefined
        ? correlations.items.map((item) => toEnrichedCorrelationDataK8s(item)).filter((i) => i !== undefined)
        : [];
    };

    console.log(currentData?.metadata.remainingItemCount);

    // we cant do a straight refetch, we have to pass in new pages if necessary
    const enhRefetch = (params: GetCorrelationsParams): Promise<CorrelationsData> => {
      return new Promise(() => enrichedCorrelations(currentData));
    };

    return (
      <CorrelationsPage
        fetchCorrelations={enhRefetch}
        correlations={{
          correlations: enrichedCorrelations(currentData),
          page: 0,
          limit: 1000,
          totalCount: enrichedCorrelations.length,
        }}
        isLoading={isLoading}
        error={error as Error}
      />
    );
  } else {
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
}
