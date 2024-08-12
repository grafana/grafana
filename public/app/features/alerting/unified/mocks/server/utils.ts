/** Helper method to help generate a kubernetes-style response with a list of items */
export const getK8sResponse = <T>(kind: string, items: T[]) => {
  return {
    kind,
    apiVersion: 'notifications.alerting.grafana.app/v0alpha1',
    metadata: {},
    items,
  };
};

/** Expected base URL for our k8s APIs */
export const ALERTING_API_SERVER_BASE_URL = '/apis/notifications.alerting.grafana.app/v0alpha1';
