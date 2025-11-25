import {
  Correlation as CorrelationK8s,
  useListCorrelationQuery,
} from '@grafana/api-clients/rtkq/correlations/v0alpha1';
import { CorrelationData, CorrelationExternal, CorrelationQuery } from '@grafana/runtime';

import { toEnrichedCorrelationData } from './useCorrelations';

/*
the various todos in this function relate to some changes that were required for correlations to be added to app platform
we now must resolve those changes with the way correlations currently functions
the main one is around the various source/target references - current this just refers to datasources by UID, but I was 
required to do a group/name combination - how do I resolve this?

secondly, I was required to remove the provisioned flag. This provisioned flag locks the correlations record and makes it readonly
so people don't make edits that will be overwritten by provisioned correlations. Maybe this isn't relevant for app platform and hardcoding it to false is fine.

With transformations, I just didn't convert because they should be straightforward, that can be ignored for now and I'll work on it

also, maybe this should be closer to the app platform code, like in the client code? any other best practices?
*/
export const toEnrichedCorrelationDataK8s = (item: CorrelationK8s): CorrelationData | undefined => {
  if (item.metadata.name !== undefined) {
    const baseCor = {
      uid: item.metadata.name,
      sourceUID: item.spec.source.name, //todo
      label: item.spec.label,
      description: item.spec.description,
      provisioned: false, // todo,
    };

    if (item.spec.type === 'external') {
      const extCorr: CorrelationExternal = {
        ...baseCor,
        type: 'external',
        config: {
          field: item.spec.config.field,
          target: {
            url: item.spec.config.target.url || '',
          },
          transformations: [], // todo fix
        },
      };
      return toEnrichedCorrelationData(extCorr);
    } else {
      const queryCorr: CorrelationQuery = {
        ...baseCor,
        type: 'query',
        targetUID: item.spec.target?.name || '', // todo
        config: {
          field: item.spec.config.field,
          target: item.spec.config.target,
          transformations: [], // todo fix
        },
      };
      return toEnrichedCorrelationData(queryCorr);
    }
  } else {
    return undefined;
  }
};

export const useCorrelationsK8s = () => {
  //const { data, isLoading, error } = correlationAPIv0alpha1.endpoints.listCorrelation.useQuery({ limit: 10 });
  const { data, isLoading, error } = useListCorrelationQuery({ limit: 10 });
  const enrichedCorrelations =
    data !== undefined
      ? data.items.map((item) => toEnrichedCorrelationDataK8s(item)).filter((i) => i !== undefined)
      : [];
  // todo returning bad response data, how to fix?

  return {
    get: {
      execute: () => {},
      value: { correlations: enrichedCorrelations, page: 0, limit: 1000, totalCount: enrichedCorrelations.length },
      loading: isLoading,
      error,
    },
  };
};

/*
       if (config.featureToggles.kubernetesCorrelations) {
        const result = await dispatch(
          correlationAPIv0alpha1.endpoints.createCorrelation.initiate({
            correlation: {
              apiVersion: 'correlations.grafana.app/v0alpha1',
              kind: 'Correlations',
              metadata: {},
              spec: {
                ...correlation,
                label: correlation.label ?? '',
                source: { name: sourceUID, group: '' },
                config: { ...correlation.config, transformations: [] },
              },
            },
          })
        );
        return result;
      } else { 
*/
