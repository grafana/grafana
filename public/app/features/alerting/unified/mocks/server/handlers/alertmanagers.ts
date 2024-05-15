import { http, HttpResponse } from 'msw';

import { MOCK_SILENCE_ID_EXISTING, mockAlertmanagerAlert } from 'app/features/alerting/unified/mocks';
import { defaultGrafanaAlertingConfigurationStatusResponse } from 'app/features/alerting/unified/mocks/alertmanagerApi';
import { MOCK_DATASOURCE_UID_BROKEN_ALERTMANAGER } from 'app/features/alerting/unified/mocks/server/handlers/datasources';
import { AlertState } from 'app/plugins/datasource/alertmanager/types';

export const grafanaAlertingConfigurationStatusHandler = (
  response = defaultGrafanaAlertingConfigurationStatusResponse
) => http.get('/api/v1/ngalert', () => HttpResponse.json(response));

export const alertmanagerAlertsListHandler = () =>
  http.get<{ datasourceUid: string }>('/api/alertmanager/:datasourceUid/api/v2/alerts', ({ params }) => {
    if (params.datasourceUid === MOCK_DATASOURCE_UID_BROKEN_ALERTMANAGER) {
      return HttpResponse.json({ traceId: '' }, { status: 502 });
    }
    return HttpResponse.json([
      mockAlertmanagerAlert({
        labels: { foo: 'bar', buzz: 'bazz' },
        status: { state: AlertState.Suppressed, silencedBy: [MOCK_SILENCE_ID_EXISTING], inhibitedBy: [] },
      }),
      mockAlertmanagerAlert({
        labels: { foo: 'bar', buzz: 'bazz' },
        status: { state: AlertState.Suppressed, silencedBy: [MOCK_SILENCE_ID_EXISTING], inhibitedBy: [] },
      }),
    ]);
  });

const handlers = [alertmanagerAlertsListHandler(), grafanaAlertingConfigurationStatusHandler()];
export default handlers;
