import {
  Correlation as CorrelationK8s,
  useListCorrelationQuery,
} from '@grafana/api-clients/rtkq/correlations/v0alpha1';
import { CorrelationData, CorrelationExternal, CorrelationQuery } from '@grafana/runtime';

import { toEnrichedCorrelationData } from './useCorrelations';

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
export const useCorrelationsK8s = (limit = 100, page: number) => {
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
  let fmtedError = undefined;

  if (error !== undefined) {
    fmtedError = new Error(error?.toString() ?? 'useListCorrelationQuery error');
  }

  return {
    currentData: enrichedCorrelations,
    isLoading,
    error: fmtedError,
    remainingItems: currentData?.metadata.remainingItemCount || 0,
  };
};
