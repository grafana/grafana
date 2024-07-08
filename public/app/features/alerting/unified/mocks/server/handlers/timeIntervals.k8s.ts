// POST /apis/notifications.alerting.grafana.app/v0alpha1/namespaces/default/timeintervals

import { HttpResponse, http } from 'msw';

import { PROVENANCE_ANNOTATION } from 'app/features/alerting/unified/components/mute-timings/useMuteTimings';
import { ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1TimeInterval } from 'app/features/alerting/unified/openapi/timeIntervalsApi.gen';

const baseUrl = '/apis/notifications.alerting.grafana.app/v0alpha1';

const getK8sResponse = <T>(kind: string, items: T[]) => {
  return {
    kind,
    apiVersion: 'notifications.alerting.grafana.app/v0alpha1',
    metadata: {},
    items,
  };
};

export const TIME_INTERVAL_UID_HAPPY_PATH = 'f4eae7a4895fa786';
export const TIME_INTERVAL_UID_PROVISIONED = 'd7b8515fc39e90f7';

const allTimeIntervals = getK8sResponse<ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1TimeInterval>(
  'TimeIntervalList',
  [
    {
      metadata: {
        annotations: {
          [PROVENANCE_ANNOTATION]: 'none',
        },
        name: TIME_INTERVAL_UID_HAPPY_PATH,
        uid: TIME_INTERVAL_UID_HAPPY_PATH,
        namespace: 'default',
        resourceVersion: 'e0270bfced786660',
      },
      spec: { name: 'Some interval', time_intervals: [] },
    },
    {
      metadata: {
        annotations: {
          [PROVENANCE_ANNOTATION]: 'file',
        },
        name: TIME_INTERVAL_UID_PROVISIONED,
        uid: TIME_INTERVAL_UID_PROVISIONED,
        namespace: 'default',
        resourceVersion: 'a76d2fcc6731aa0c',
      },
      spec: { name: 'A provisioned interval', time_intervals: [] },
    },
  ]
);

const getIntervalByName = (name: string) => {
  return allTimeIntervals.items.find((interval) => interval.metadata.name === name);
};

export const listNamespacedTimeIntervalHandler = () =>
  http.get<{ namespace: string }>(`${baseUrl}/namespaces/:namespace/timeintervals`, ({ params }) => {
    const { namespace } = params;

    // k8s APIs expect `default` rather than `org-1` - this is one particular example
    // to make sure we're performing the correct logic when calling this API
    if (namespace === 'org-1') {
      return HttpResponse.json(
        {
          message: 'error reading namespace: use default rather than org-1',
        },
        { status: 403 }
      );
    }
    return HttpResponse.json(allTimeIntervals);
  });

const readNamespacedTimeIntervalHandler = () =>
  http.get<{ namespace: string; name: string }>(
    `${baseUrl}/namespaces/:namespace/timeintervals/:name`,
    ({ params }) => {
      const { name } = params;

      const matchingInterval = getIntervalByName(name);
      if (!matchingInterval) {
        return HttpResponse.json({}, { status: 404 });
      }
      return HttpResponse.json(matchingInterval);
    }
  );

const replaceNamespacedTimeIntervalHandler = () =>
  http.put<{ namespace: string; name: string }>(
    `${baseUrl}/namespaces/:namespace/timeintervals/:name`,
    async ({ params, request }) => {
      const { name } = params;

      const matchingInterval = allTimeIntervals.items.find((interval) => interval.metadata.name === name);
      if (!matchingInterval) {
        return HttpResponse.json({}, { status: 404 });
      }

      const body = await request.clone().json();
      return HttpResponse.json(body);
    }
  );

const createNamespacedTimeIntervalHandler = () =>
  http.post<{ namespace: string }>(`${baseUrl}/namespaces/:namespace/timeintervals`, () => {
    return HttpResponse.json({});
  });

const deleteNamespacedTimeIntervalHandler = () =>
  http.delete<{ namespace: string }>(`${baseUrl}/namespaces/:namespace/timeintervals/:name`, () => {
    return HttpResponse.json({});
  });

const handlers = [
  listNamespacedTimeIntervalHandler(),
  readNamespacedTimeIntervalHandler(),
  replaceNamespacedTimeIntervalHandler(),
  createNamespacedTimeIntervalHandler(),
  deleteNamespacedTimeIntervalHandler(),
];
export default handlers;
