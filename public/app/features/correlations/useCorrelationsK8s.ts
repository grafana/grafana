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

// we're faking traditional pagination here, realistically folks shouldnt have enough correlations to see a performance impact but if they do we can change the ui
export const useCorrelationsK8s = (limit: number, page: number) => {
  let pagedLimit = limit;
  if (page > 1) {
    pagedLimit = limit * page;
  }

  const { currentData, isLoading, error } = useListCorrelationQuery({ limit: pagedLimit });
  const startIdx = limit * (page - 1);
  const pagedData = currentData?.items.slice(startIdx, startIdx + limit) ?? [];

  const enrichedCorrelations =
    currentData !== undefined
      ? pagedData.map((item) => toEnrichedCorrelationDataK8s(item)).filter((i) => i !== undefined)
      : [];

  return {
    currentData: enrichedCorrelations,
    isLoading,
    error,
    remainingItems: currentData?.metadata.remainingItemCount || 0,
  };
};
