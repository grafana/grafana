import { createApi, BaseQueryFn } from '@reduxjs/toolkit/query/react';
import { lastValueFrom } from 'rxjs';

import { getBackendSrv, config } from '@grafana/runtime';

const featureApiVersion = 'featuretoggle.grafana.app/v0alpha1';

type FeatureToggle = {
  name: string;
  description?: string;
  enabled: boolean;
  readOnly?: boolean;
  hidden?: boolean;
};

type FeatureMgmtState = {
  restartRequired: boolean;
  allowEditing: boolean;
};

type QueryArgs = {
  url: string;
  method?: string;
  body?: { featureToggles: FeatureToggle[] };
};

interface ResolvedToggleState {
  kind: string;
  toggles?: K8sToggleSpec[]; // not used in patch
  enabled: { [key: string]: boolean };
}

interface K8sToggleSpec {
  name: string;
  description: string;
  enabled: boolean;
  writeable: boolean;
  source: K8sToggleSource;
}

interface K8sToggleSource {
  namespace: string;
  name: string;
}

const backendSrvBaseQuery =
  ({ baseUrl }: { baseUrl: string }): BaseQueryFn<QueryArgs> =>
  async ({ url, method = 'GET', body }) => {
    try {
      const { data } = await lastValueFrom(
        getBackendSrv().fetch({
          url: baseUrl + url,
          method,
          data: body,
        })
      );
      return { data };
    } catch (error) {
      return { error };
    }
  };

const getK8sAPI = () => {
  return createApi({
    reducerPath: 'togglesApi',
    baseQuery: backendSrvBaseQuery({ baseUrl: `/apis/${featureApiVersion}/` }),
    endpoints: (builder) => ({
      getManagerState: builder.query<FeatureMgmtState, void>({
        query: () => ({ url: 'state' }),
      }),
      getFeatureToggles: builder.query<FeatureToggle[], void>({
        query: () => ({ url: 'current' }),
      }),
      updateFeatureToggles: builder.mutation<void, FeatureToggle[]>({
        query: (updatedToggles) => ({
          url: 'current',
          method: 'PATCH',
          body: convertModifiedTogglesToK8sObject(updatedToggles),
        }),
      }),
    }),
  });
};

const getLegacyAPI = () => {
  return createApi({
    reducerPath: 'togglesApi',
    baseQuery: backendSrvBaseQuery({ baseUrl: '/api' }),
    endpoints: (builder) => ({
      getManagerState: builder.query<FeatureMgmtState, void>({
        query: () => ({ url: '/featuremgmt/state' }),
      }),
      getFeatureToggles: builder.query<FeatureToggle[], void>({
        query: () => ({ url: '/featuremgmt' }),
      }),
      updateFeatureToggles: builder.mutation<void, FeatureToggle[]>({
        query: (updatedToggles) => ({
          url: '/featuremgmt',
          method: 'POST',
          body: { featureToggles: updatedToggles },
        }),
      }),
    }),
  });
};

function convertModifiedTogglesToK8sObject(toggles: FeatureToggle[]): ResolvedToggleState {
  const patchBody: ResolvedToggleState = {
    kind: 'ResolvedToggleState',
    enabled: {},
  };
  toggles.forEach((t) => {
    patchBody.enabled[t.name] = t.enabled;
  });
  return patchBody;
}

const togglesApi = config.featureToggles.kubernetesFeatureToggles ? getK8sAPI() : getLegacyAPI();
let { useGetManagerStateQuery, useGetFeatureTogglesQuery, useUpdateFeatureTogglesMutation } = togglesApi;

if (config.featureToggles.kubernetesFeatureToggles) {
  // create a wrapper around each of the handlers to optionally return a k8s object
  useGetFeatureTogglesQuery = (): { data: FeatureToggle[]; isLoading: boolean; isError: boolean } => {
    const { data, isLoading, isError } = togglesApi.useGetFeatureTogglesQuery();
    const toggles: FeatureToggle[] = [];
    data?.toggles?.forEach((t: K8sToggleSpec) => {
      toggles.push({
        name: t.name,
        description: t.description,
        enabled: t.enabled,
        readOnly: !t.writeable,
      });
    });

    return {
      data: toggles,
      isLoading,
      isError,
    };
  };
}

export { togglesApi };
export { useGetManagerStateQuery, useGetFeatureTogglesQuery, useUpdateFeatureTogglesMutation };
export type { FeatureToggle, FeatureMgmtState };
