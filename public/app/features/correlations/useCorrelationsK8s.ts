import { handleRequestError } from '@grafana/api-clients';
import {
  Correlation as CorrelationK8s,
  useListCorrelationQuery,
} from '@grafana/api-clients/rtkq/correlations/v0alpha1';
import { SupportedTransformationType } from '@grafana/data';
import { CorrelationData, CorrelationExternal, CorrelationQuery, getDataSourceSrv } from '@grafana/runtime';

import { toEnrichedCorrelationData } from './useCorrelations';

export const toEnrichedCorrelationDataK8s = (item: CorrelationK8s): CorrelationData | undefined => {
  const dsSrv = getDataSourceSrv();
  const sourceDS = dsSrv.getInstanceSettings({ type: item.spec.source.group, uid: item.spec.source.name });
  if (sourceDS !== undefined) {
    const baseCor = {
      uid: item.metadata.name!,
      sourceUID: sourceDS.uid,
      label: item.spec.label,
      description: item.spec.description,
      provisioned: false, // todo
    };

    const transformationsFmt = item.spec.config.transformations?.map((trans) => {
      return {
        ...trans,
        type: trans.type === 'regex' ? SupportedTransformationType.Regex : SupportedTransformationType.Logfmt,
      };
    });

    if (item.spec.type === 'external') {
      const extCorr: CorrelationExternal = {
        ...baseCor,
        type: 'external',
        config: {
          field: item.spec.config.field,
          target: {
            url: item.spec.config?.target?.url || '',
          },
          transformations: transformationsFmt,
        },
      };
      return toEnrichedCorrelationData(extCorr);
    } else {
      const targetDs = dsSrv.getInstanceSettings({ type: item.spec.target?.group, uid: item.spec.target?.name });
      if (targetDs !== undefined) {
        const queryCorr: CorrelationQuery = {
          ...baseCor,
          type: 'query',
          targetUID: targetDs.uid,
          config: {
            field: item.spec.config.field,
            target: item.spec.config.target,
            transformations: transformationsFmt,
          },
        };
        return toEnrichedCorrelationData(queryCorr);
      } else {
        return undefined;
      }
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
      ? pagedData
          .filter((i) => i.metadata.name !== undefined)
          .map((item) => toEnrichedCorrelationDataK8s(item))
          .filter((i) => i !== undefined)
      : [];

  const fmtedError = error ? handleRequestError(error) : undefined;

  return {
    currentData: enrichedCorrelations,
    isLoading,
    error: fmtedError,
    remainingItems: currentData?.metadata.remainingItemCount || 0,
    doesContinue: currentData?.metadata.continue !== undefined,
  };
};
