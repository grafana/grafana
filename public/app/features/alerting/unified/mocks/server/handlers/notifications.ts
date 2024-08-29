import { HttpResponse, http } from 'msw';

import alertmanagerConfig from 'app/features/alerting/unified/components/contact-points/__mocks__/alertmanager.config.mock.json';
import { GrafanaManagedContactPoint, MuteTimeInterval } from 'app/plugins/datasource/alertmanager/types';

const defaultReceiversResponse: GrafanaManagedContactPoint[] = alertmanagerConfig.alertmanager_config.receivers;

const defaultTimeIntervalsResponse: MuteTimeInterval[] = alertmanagerConfig.alertmanager_config.time_intervals;

const getNotificationReceiversHandler = (response = defaultReceiversResponse) =>
  http.get('/api/v1/notifications/receivers', () => HttpResponse.json(response));

const getTimeIntervalsHandler = (response = defaultTimeIntervalsResponse) =>
  http.get('/api/v1/notifications/time-intervals', () => HttpResponse.json(response));

const handlers = [getNotificationReceiversHandler(), getTimeIntervalsHandler()];

export default handlers;
