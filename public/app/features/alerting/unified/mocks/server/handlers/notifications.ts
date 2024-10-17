import { HttpResponse, http } from 'msw';

import { getAlertmanagerConfig } from 'app/features/alerting/unified/mocks/server/entities/alertmanagers';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';

const alertmanagerConfig = getAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME);
const defaultReceiversResponse = alertmanagerConfig.alertmanager_config.receivers;
const defaultTimeIntervalsResponse = alertmanagerConfig.alertmanager_config.time_intervals;

const getNotificationReceiversHandler = (response = defaultReceiversResponse) =>
  http.get('/api/v1/notifications/receivers', () => HttpResponse.json(response));

const getTimeIntervalsHandler = (response = defaultTimeIntervalsResponse) =>
  http.get('/api/v1/notifications/time-intervals', () => HttpResponse.json(response));

const handlers = [getNotificationReceiversHandler(), getTimeIntervalsHandler()];

export default handlers;
