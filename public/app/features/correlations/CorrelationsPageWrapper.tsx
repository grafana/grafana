import {
  generatedAPI as correlationAPIv0alpha1,
  CorrelationList,
} from '@grafana/api-clients/rtkq/correlations/v0alpha1';
import { config, CorrelationsData } from '@grafana/runtime';

import CorrelationsPage from './CorrelationsPage';
import { GetCorrelationsParams } from './types';
import { useCorrelations } from './useCorrelations';
import { toEnrichedCorrelationDataK8s } from './useCorrelationsK8s';

export default function CorrelationsPageWrapper() {
  //const { remove, get } = useCorrelations();
  try {
    const { data, isLoading, error } = correlationAPIv0alpha1.endpoints.listCorrelation.useQuery({});

    //if (config.featureToggles.kubernetesCorrelations) {
    const enrichedCorrelations = (correlations?: CorrelationList) => {
      return correlations !== undefined
        ? correlations.items.map((item) => toEnrichedCorrelationDataK8s(item)).filter((i) => i !== undefined)
        : [];
    };

    // we cant do a straight refetch, we have to pass in new pages if necessary
    const enhRefetch = (params: GetCorrelationsParams): Promise<CorrelationsData> => {
      const { data } = correlationAPIv0alpha1.endpoints.listCorrelation.useQuery({});
      return new Promise(() => enrichedCorrelations(data));
    };

    return (
      <CorrelationsPage
        fetchCorrelations={enhRefetch}
        correlations={{
          correlations: enrichedCorrelations(data),
          page: 0,
          limit: 1000,
          totalCount: enrichedCorrelations.length,
        }}
        isLoading={isLoading}
        error={error as Error}
      />
    );
  } catch (e) {
    console.log(e);
  }

  /*} else {
    return (
      <CorrelationsPage
        fetchCorrelations={get.execute}
        correlations={get.value}
        isLoading={get.loading}
        error={get.error}
        removeFn={remove.execute}
      />
    );
  }*/
}
