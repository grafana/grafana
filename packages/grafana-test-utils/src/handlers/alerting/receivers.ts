import { HttpResponse, http } from 'msw';

import { fixtures } from '../../fixtures';

const ALERTING_API_SERVER_BASE_URL = '/apis/notifications.alerting.grafana.app/v0alpha1';

const listNamespacedReceiverHandler = () =>
  http.get<{ namespace: string }>(`${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/receivers`, () => {
    return HttpResponse.json({
      items: [
        {
          metadata: {
            name: 'Z3JhZmFuYS1kZWZhdWx0LWVtYWls',
            namespace: 'default',
            uid: 'zyXFk301pvwNz4HRPrTMKPMFO2934cPB7H1ZXmyM1TUX',
            resourceVersion: '4e0e4bb6339c0715',
            creationTimestamp: null,
            annotations: {
              'grafana.com/access/canAdmin': 'true',
              'grafana.com/access/canDelete': 'true',
              'grafana.com/access/canReadSecrets': 'true',
              'grafana.com/access/canWrite': 'true',
              'grafana.com/inUse/routes': '2',
              'grafana.com/inUse/rules': '4',
              'grafana.com/provenance': 'none',
            },
          },
          spec: {
            title: fixtures.alerting.CONTACT_POINT_EMAIL_TITLE,
            integrations: [
              {
                uid: 'bdeynkry1ih34b',
                type: 'email',
                disableResolveMessage: true,
                settings: {
                  addresses: '<example@email.com>,',
                  message: '{{ template "default.message" . }}',
                  singleEmail: false,
                },
              },
            ],
          },
          status: {},
        },
      ],
    });
  });

const handlers = [listNamespacedReceiverHandler()];
export default handlers;
