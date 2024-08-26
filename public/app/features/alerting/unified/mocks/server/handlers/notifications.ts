import { HttpResponse, http } from 'msw';

import alertmanagerConfig from 'app/features/alerting/unified/components/contact-points/__mocks__/alertmanager.config.mock.json';
import { GrafanaManagedContactPoint } from 'app/plugins/datasource/alertmanager/types';

const defaultReceiversResponse: GrafanaManagedContactPoint[] = JSON.parse(JSON.stringify(alertmanagerConfig))
  .alertmanager_config.receivers;

const getNotificationReceiversHandler = (response = defaultReceiversResponse) =>
  http.get('/api/v1/notifications/receivers', () => HttpResponse.json(response));

const handlers = [getNotificationReceiversHandler()];
export default handlers;
