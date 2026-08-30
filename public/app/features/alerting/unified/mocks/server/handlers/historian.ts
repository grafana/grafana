import { HttpResponse, http } from 'msw';

import {
  type CreateNotificationqueryNotificationEntry,
  type CreateNotificationqueryResponse,
  type CreateNotificationsqueryalertsNotificationEntryAlert,
  type CreateNotificationsqueryalertsResponse,
} from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';

export const HISTORIAN_BASE = '/apis/historian.alerting.grafana.app/v0alpha1/namespaces/default';

let notificationEntries: CreateNotificationqueryNotificationEntry[] = [];
let alertEntries: CreateNotificationsqueryalertsNotificationEntryAlert[] = [];

export function setHistorianNotifications(entries: CreateNotificationqueryNotificationEntry[]) {
  notificationEntries = entries;
}

export function setHistorianAlerts(alerts: CreateNotificationsqueryalertsNotificationEntryAlert[]) {
  alertEntries = alerts;
}

export function resetHistorianState() {
  notificationEntries = [];
  alertEntries = [];
}

const notificationQueryHandler = () =>
  http.post(`${HISTORIAN_BASE}/notification/query`, () => {
    const response: CreateNotificationqueryResponse = { entries: notificationEntries, counts: [] };
    return HttpResponse.json(response);
  });

const alertsQueryHandler = () =>
  http.post(`${HISTORIAN_BASE}/notifications/queryalerts`, () => {
    const response: CreateNotificationsqueryalertsResponse = { alerts: alertEntries };
    return HttpResponse.json(response);
  });

const handlers = [notificationQueryHandler(), alertsQueryHandler()];
export default handlers;
