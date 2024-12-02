import { HttpResponse, http } from 'msw';

import { getAlertmanagerConfig } from 'app/features/alerting/unified/mocks/server/entities/alertmanagers';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';

const getNotificationReceiversHandler = () =>
  http.get('/api/v1/notifications/receivers', () => {
    const receivers = getAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME).alertmanager_config.receivers || [];

    return HttpResponse.json(receivers);
  });

const getTimeIntervalsHandler = () =>
  http.get('/api/v1/notifications/time-intervals', () => {
    const intervals = getAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME).alertmanager_config.time_intervals;

    return HttpResponse.json(intervals);
  });

const handlers = [getNotificationReceiversHandler(), getTimeIntervalsHandler()];

export default handlers;
