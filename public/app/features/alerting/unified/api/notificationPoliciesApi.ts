import { generatedRoutesApi } from 'app/features/alerting/unified/openapi/routesApi.gen';

export const routingTreeApi = generatedRoutesApi.enhanceEndpoints({
  endpoints: {
    replaceNamespacedRoutingTree: {
      // Stop a failed mutation from invalidating the cache, as otherwise the notification policies
      // components will re-attach IDs to the routes, and then the user can't update the route anyway
      invalidatesTags: (_, error) => (error ? [] : ['RoutingTree']),
    },
  },
});
