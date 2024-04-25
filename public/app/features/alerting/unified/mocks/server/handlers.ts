/**
 * Contains definitions for all handlers that are required for test rendering of components within Alerting
 */

import { HttpResponse, http } from 'msw';

import { mockAlertmanagerAlert, mockSilences } from 'app/features/alerting/unified/mocks';
import { defaultAlertmanagerChoiceResponse } from 'app/features/alerting/unified/mocks/alertmanagerApi';
import { AlertState } from 'app/plugins/datasource/alertmanager/types';

///////////////////
// Alertmanagers //
///////////////////

export const alertmanagerChoiceHandler = (response = defaultAlertmanagerChoiceResponse) =>
  http.get('/api/v1/ngalert', () => HttpResponse.json(response));

const alertmanagerAlertsListHandler = () =>
  http.get('/api/alertmanager/:datasourceUid/api/v2/alerts', () =>
    HttpResponse.json([
      mockAlertmanagerAlert({
        labels: { foo: 'bar', buzz: 'bazz' },
        status: { state: AlertState.Suppressed, silencedBy: ['12345'], inhibitedBy: [] },
      }),
      mockAlertmanagerAlert({
        labels: { foo: 'bar', buzz: 'bazz' },
        status: { state: AlertState.Suppressed, silencedBy: ['12345'], inhibitedBy: [] },
      }),
    ])
  );

/////////////////
// Datasources //
/////////////////

// TODO: Add more accurate endpoint responses as tests require
const datasourceBuildInfoHandler = () =>
  http.get('/api/datasources/proxy/uid/:datasourceUid/api/v1/status/buildinfo', () => HttpResponse.json({}));

//////////////
// Silences //
//////////////

const silencesListHandler = (silences = mockSilences) =>
  http.get('/api/alertmanager/:datasourceUid/api/v2/silences', () => HttpResponse.json(silences));

const createSilenceHandler = () =>
  http.post('/api/alertmanager/:datasourceUid/api/v2/silences', () =>
    HttpResponse.json({ silenceId: '4bda5b38-7939-4887-9ec2-16323b8e3b4e' })
  );

/**
 * All mock handlers that are required across Alerting tests
 */
const allHandlers = [
  alertmanagerChoiceHandler(),
  silencesListHandler(),
  createSilenceHandler(),
  alertmanagerAlertsListHandler(),
  datasourceBuildInfoHandler(),
];

export default allHandlers;
