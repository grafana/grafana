/**
 * Contains definitions for all handlers that are required for test rendering of components within Alerting
 */

import { HttpResponse, http } from 'msw';

import { defaultAlertmanagerChoiceResponse } from 'app/features/alerting/unified/mocks/alertmanagerApi';

export const alertmanagerChoiceHandler = (response = defaultAlertmanagerChoiceResponse) =>
  http.get('/api/v1/ngalert', () => HttpResponse.json(response));
