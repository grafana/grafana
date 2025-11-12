import { useAsyncFn } from 'react-use';
import { lastValueFrom } from 'rxjs';

import {
  generatedAPI as correlationAPIv0alpha1,
  Correlation as CorrelationK8s,
} from '@grafana/api-clients/rtkq/correlations/v0alpha1';
import {
  getDataSourceSrv,
  FetchResponse,
  CorrelationData,
  CorrelationsData,
  config,
  CorrelationExternal,
  CorrelationQuery,
} from '@grafana/runtime';
import { useGrafana } from 'app/core/context/GrafanaContext';

import {
  Correlation,
  CreateCorrelationParams,
  CreateCorrelationResponse,
  GetCorrelationsParams,
  RemoveCorrelationParams,
  RemoveCorrelationResponse,
  UpdateCorrelationParams,
  UpdateCorrelationResponse,
} from './types';
import { correlationsLogger } from './utils';

export interface CorrelationsResponse {
  correlations: Correlation[];
  page: number;
  limit: number;
  totalCount: number;
}

const toEnrichedCorrelationData = ({ sourceUID, ...correlation }: Correlation): CorrelationData | undefined => {
  const sourceDatasource = getDataSourceSrv().getInstanceSettings(sourceUID);
  const targetDatasource =
    correlation.type === 'query' ? getDataSourceSrv().getInstanceSettings(correlation.targetUID) : undefined;

  // According to #72258 we will remove logic to handle orgId=0/null as global correlations.
  // This logging is to check if there are any customers who did not migrate existing correlations.
  // See Deprecation Notice in https://github.com/grafana/grafana/pull/72258 for more details
  if (correlation?.orgId === undefined || correlation?.orgId === null || correlation?.orgId === 0) {
    correlationsLogger.logWarning('Invalid correlation config: Missing org id.');
  }

  if (
    sourceDatasource &&
    sourceDatasource?.uid !== undefined &&
    targetDatasource?.uid !== undefined &&
    correlation.type === 'query'
  ) {
    return {
      ...correlation,
      source: sourceDatasource,
      target: targetDatasource,
    };
  }

  if (
    sourceDatasource &&
    sourceDatasource?.uid !== undefined &&
    targetDatasource?.uid === undefined &&
    correlation.type === 'external'
  ) {
    return {
      ...correlation,
      source: sourceDatasource,
    };
  }

  correlationsLogger.logWarning(`Invalid correlation config: Missing source or target.`, {
    source: JSON.stringify(sourceDatasource),
    target: JSON.stringify(targetDatasource),
  });
  return undefined;
};

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
const toEnrichedCorrelationDataK8s = (item: CorrelationK8s): CorrelationData | undefined => {
  if (item.metadata.name !== undefined) {
    const baseCor = {
      uid: item.metadata.name,
      sourceUID: item.spec.source.name, //todo
      label: item.spec.label,
      description: item.spec.description,
      provisioned: false, // todo
    };

    if (item.spec.type === 'external') {
      const extCorr: CorrelationExternal = {
        ...baseCor,
        type: 'external',
        config: {
          field: item.spec.config.field,
          target: {
            url: item.spec.config.target.url.url || '', // todo this is wrong, fix in spec
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
          target: item.spec.config.target, // todo
          transformations: [], // todo fix
        },
      };
      return toEnrichedCorrelationData(queryCorr);
    }
  } else {
    return undefined;
  }
};

const validSourceFilter = (correlation: CorrelationData | undefined): correlation is CorrelationData => !!correlation;

export const toEnrichedCorrelationsData = (correlationsResponse: CorrelationsResponse): CorrelationsData => {
  return {
    ...correlationsResponse,
    correlations: correlationsResponse.correlations.map(toEnrichedCorrelationData).filter(validSourceFilter),
  };
};

export function getData<T>(response: FetchResponse<T>) {
  return response.data;
}

/**
 * hook for managing correlations data.
 * TODO: ideally this hook shouldn't have any side effect like showing notifications on error
 * and let consumers handle them. It works nicely with the correlations settings page, but when we'll
 * expose this we'll have to remove those side effects.
 */
export const useCorrelations = () => {
  const { backend } = useGrafana();

  const [getInfo, get] = useAsyncFn<(params: GetCorrelationsParams) => Promise<CorrelationsData>>(
    async (params) => {
      if (config.featureToggles.kubernetesCorrelations) {
        // the legacy version has pages , how does one accomplish this when getting a full list back?
        const { data } = correlationAPIv0alpha1.endpoints.listCorrelation.useQuery({});
        const enrichedCorrelations =
          data !== undefined
            ? data.items.map((item) => toEnrichedCorrelationDataK8s(item)).filter((i) => i !== undefined)
            : [];
        // todo returning bad response data, how to fix?
        return { correlations: enrichedCorrelations, page: 0, limit: 1000, totalCount: enrichedCorrelations.length };
      } else {
        return lastValueFrom(
          backend.fetch<CorrelationsResponse>({
            url: '/api/datasources/correlations',
            params: { page: params.page },
            method: 'GET',
            showErrorAlert: false,
          })
        )
          .then(getData)
          .then(toEnrichedCorrelationsData);
      }
    },

    [backend]
  );

  const [createInfo, create] = useAsyncFn<(params: CreateCorrelationParams) => Promise<CorrelationData>>(
    ({ sourceUID, ...correlation }) =>
      backend
        .post<CreateCorrelationResponse>(`/api/datasources/uid/${sourceUID}/correlations`, correlation)
        .then((response) => {
          const enrichedCorrelation = toEnrichedCorrelationData(response.result);
          if (enrichedCorrelation !== undefined) {
            return enrichedCorrelation;
          } else {
            throw new Error('invalid sourceUID');
          }
        }),
    [backend]
  );

  const [removeInfo, remove] = useAsyncFn<(params: RemoveCorrelationParams) => Promise<{ message: string }>>(
    ({ sourceUID, uid }) =>
      backend.delete<RemoveCorrelationResponse>(`/api/datasources/uid/${sourceUID}/correlations/${uid}`),
    [backend]
  );

  const [updateInfo, update] = useAsyncFn<(params: UpdateCorrelationParams) => Promise<CorrelationData>>(
    ({ sourceUID, uid, ...correlation }) =>
      backend
        .patch<UpdateCorrelationResponse>(`/api/datasources/uid/${sourceUID}/correlations/${uid}`, correlation)
        .then((response) => {
          const enrichedCorrelation = toEnrichedCorrelationData(response.result);
          if (enrichedCorrelation !== undefined) {
            return enrichedCorrelation;
          } else {
            throw new Error('invalid sourceUID');
          }
        }),
    [backend]
  );

  return {
    create: {
      execute: create,
      ...createInfo,
    },
    update: {
      execute: update,
      ...updateInfo,
    },
    get: {
      execute: get,
      ...getInfo,
    },
    remove: {
      execute: remove,
      ...removeInfo,
    },
  };
};
