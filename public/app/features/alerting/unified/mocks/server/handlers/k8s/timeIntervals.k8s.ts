import { HttpResponse, http } from 'msw';

import { filterBySelector } from 'app/features/alerting/unified/mocks/server/handlers/k8s/utils';
import { ALERTING_API_SERVER_BASE_URL, getK8sResponse } from 'app/features/alerting/unified/mocks/server/utils';
import { ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1TimeInterval } from 'app/features/alerting/unified/openapi/timeIntervalsApi.gen';
import { PROVENANCE_ANNOTATION, PROVENANCE_NONE } from 'app/features/alerting/unified/utils/k8s/constants';

/** UID of a time interval that we expect to follow all happy paths within tests/mocks */
export const TIME_INTERVAL_UID_HAPPY_PATH = 'f4eae7a4895fa786';
/** Display name of a time interval that we expect to follow all happy paths within tests/mocks */
export const TIME_INTERVAL_NAME_HAPPY_PATH = 'Some interval';

/** UID of a (file) provisioned time interval */
export const TIME_INTERVAL_UID_FILE_PROVISIONED = 'd7b8515fc39e90f7';
export const TIME_INTERVAL_NAME_FILE_PROVISIONED = 'A provisioned interval';

const allTimeIntervals = getK8sResponse<ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1TimeInterval>(
  'TimeIntervalList',
  [
    {
      metadata: {
        annotations: {
          [PROVENANCE_ANNOTATION]: PROVENANCE_NONE,
        },
        name: TIME_INTERVAL_UID_HAPPY_PATH,
        uid: TIME_INTERVAL_UID_HAPPY_PATH,
        namespace: 'default',
        resourceVersion: 'e0270bfced786660',
      },
      spec: { name: TIME_INTERVAL_NAME_HAPPY_PATH, time_intervals: [] },
    },
    {
      metadata: {
        annotations: {
          [PROVENANCE_ANNOTATION]: 'file',
        },
        name: TIME_INTERVAL_UID_FILE_PROVISIONED,
        uid: TIME_INTERVAL_UID_FILE_PROVISIONED,
        namespace: 'default',
        resourceVersion: 'a76d2fcc6731aa0c',
      },
      spec: { name: TIME_INTERVAL_NAME_FILE_PROVISIONED, time_intervals: [] },
    },
  ]
);

const getIntervalByName = (name: string) => {
  return allTimeIntervals.items.find((interval) => interval.metadata.name === name);
};

export const listNamespacedTimeIntervalHandler = () =>
  http.get<{ namespace: string }, { fieldSelector: string }>(
    `${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/timeintervals`,
    ({ params, request }) => {
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

      // Rudimentary filter support for `spec.name`
      const url = new URL(request.url);
      const fieldSelector = url.searchParams.get('fieldSelector');

      if (fieldSelector && fieldSelector.includes('spec.name')) {
        const filteredItems = filterBySelector(allTimeIntervals.items, fieldSelector);

        return HttpResponse.json({ items: filteredItems });
      }

      return HttpResponse.json(allTimeIntervals);
    }
  );

const readNamespacedTimeIntervalHandler = () =>
  http.get<{ namespace: string; name: string }>(
    `${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/timeintervals/:name`,
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
    `${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/timeintervals/:name`,
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
  http.post<{ namespace: string }>(`${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/timeintervals`, () => {
    return HttpResponse.json({});
  });

const deleteNamespacedTimeIntervalHandler = () =>
  http.delete<{ namespace: string }>(
    `${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/timeintervals/:name`,
    () => {
      return HttpResponse.json({});
    }
  );

const handlers = [
  listNamespacedTimeIntervalHandler(),
  readNamespacedTimeIntervalHandler(),
  replaceNamespacedTimeIntervalHandler(),
  createNamespacedTimeIntervalHandler(),
  deleteNamespacedTimeIntervalHandler(),
];
export default handlers;
