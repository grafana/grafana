import memoize from 'micro-memoize';

import { MatcherOperator, Route } from 'app/plugins/datasource/alertmanager/types';

import { alertmanagerApi } from '../../api/alertmanagerApi';
import {
  ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RouteSpec,
  ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1SubRoute,
  IoK8SApimachineryPkgApisMetaV1ObjectMeta,
  generatedRoutesApi,
} from '../../openapi/routesApi.gen';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { PROVENANCE_ANNOTATION, PROVENANCE_NONE } from '../../utils/k8s/constants';
import { shouldUseK8sApi } from '../../utils/k8s/utils';
import { getK8sNamespace } from '../mute-timings/util';

const k8sRouteToRouteMemoized = memoize(k8sRouteToRoute, { maxSize: 1 });

export const useNotificationPolicyRoute = (selectedAlertmanager: string | undefined) => {
  const { useListNamespacedRouteQuery } = generatedRoutesApi;
  const { useGetAlertmanagerConfigurationQuery } = alertmanagerApi;

  const k8sApiSupported = shouldUseK8sApi(selectedAlertmanager);

  if (!selectedAlertmanager) {
    throw new Error('selectedAlertmanager is required');
  }

  const k8sRouteQuery = useListNamespacedRouteQuery(
    { namespace: getK8sNamespace() },
    {
      skip: !k8sApiSupported || selectedAlertmanager !== GRAFANA_RULES_SOURCE_NAME,
      selectFromResult: (result) => ({
        ...result,
        currentData: result.currentData
          ? k8sRouteToRouteMemoized(result.currentData.spec, result.currentData.metadata)
          : undefined,
        data: result.data ? k8sRouteToRoute(result.data.spec, result.data.metadata) : undefined,
      }),
    }
  );

  const amConfigQuery = useGetAlertmanagerConfigurationQuery(selectedAlertmanager, {
    skip: !k8sApiSupported,
    selectFromResult: (result) => ({
      ...result,
      currentData: result.currentData ? result.currentData.alertmanager_config.route : undefined,
      data: result.data ? result.data.alertmanager_config.route : undefined,
    }),
  });

  return k8sApiSupported ? k8sRouteQuery : amConfigQuery;
};

export function useUpdateNotificationPolicyRoute(selectedAlertmanager: string) {
  const { useCreateNamespacedRouteMutation } = generatedRoutesApi;
  const { useUpdateAlertmanagerConfigurationMutation, useLazyGetAlertmanagerConfigurationQuery } = alertmanagerApi;

  const [getAlertmanagerConfiguration] = useLazyGetAlertmanagerConfigurationQuery();
  const [updateAlertmanagerConfiguration] = useUpdateAlertmanagerConfigurationMutation();

  const [createNamespacedRoute] = useCreateNamespacedRouteMutation();

  const k8sApiSupported = shouldUseK8sApi(selectedAlertmanager);

  async function updateUsingK8sApi({ newRoute, oldRoute }: { newRoute: Route; oldRoute: Route }) {
    const namespace = getK8sNamespace();

    // Convert Route to K8s compatible format
    const k8sRoute: ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RouteSpec = {
      ...newRoute,
      receiver: newRoute.receiver ?? '', // TODO Types are incorrect. Undefined should be allowed.
      routes: newRoute.routes?.map(routeToK8sSubRoute),
    };

    // TODO Add a check to see if not updated in the meantime

    // Create the K8s route object
    const routeObject = { spec: k8sRoute, metadata: {} };

    return createNamespacedRoute({
      namespace,
      comGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1Route: routeObject,
    }).unwrap();
  }

  async function updateUsingConfigFileApi({ newRoute, oldRoute }: { newRoute: Route; oldRoute: Route }) {
    const lastConfig = await getAlertmanagerConfiguration(selectedAlertmanager).unwrap();

    const configChangedInMeantime = JSON.stringify(oldRoute) !== JSON.stringify(lastConfig.alertmanager_config.route);

    if (configChangedInMeantime) {
      throw new Error(
        'A newer Alertmanager configuration is available. Please reload the page and try again to not overwrite recent changes.'
      );
    }

    const newConfig = {
      ...lastConfig,
      alertmanager_config: {
        ...lastConfig.alertmanager_config,
        route: newRoute,
      },
    };

    // TODO This needs to properly handle lazy AM initialization
    return updateAlertmanagerConfiguration({
      selectedAlertmanager,
      config: newConfig,
    }).unwrap();
  }

  return k8sApiSupported ? updateUsingK8sApi : updateUsingConfigFileApi;
}

function k8sRouteToRoute(
  route: ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1RouteSpec,
  metadata: IoK8SApimachineryPkgApisMetaV1ObjectMeta
): Route {
  return {
    ...route,
    provenance: metadata.annotations?.[PROVENANCE_ANNOTATION] ?? PROVENANCE_NONE,
    routes: route.routes?.map(k8sSubRouteToRoute),
  };
}

function k8sSubRouteToRoute(route: ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1SubRoute): Route {
  return {
    ...route,
    matchers: undefined,
    object_matchers: route.matchers?.map((m) => [m.label, m.type as MatcherOperator, m.value]),
    routes: route.routes?.map(k8sSubRouteToRoute),
  };
}

function routeToK8sSubRoute(route: Route): ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1SubRoute {
  return {
    ...route,
    receiver: route.receiver ?? undefined,
    matchers: route.object_matchers?.map(([label, type, value]) => ({
      label,
      type,
      value,
    })),
    routes: route.routes?.map(routeToK8sSubRoute),
  };
}
