import { useEffect } from 'react';

import { useCreateNotificationsqueryalertsMutation } from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';

const QUERY_ALERTS_LIMIT = 10;
const QUERY_ALERTS_TIME_WINDOW_MS = 1000;

export function useNotificationAlerts(uuid: string, timestamp: string) {
  const [queryAlerts, { data: alertsData, isLoading }] = useCreateNotificationsqueryalertsMutation();

  useEffect(() => {
    const from = timestamp;
    const to = new Date(new Date(timestamp).getTime() + QUERY_ALERTS_TIME_WINDOW_MS).toISOString();
    queryAlerts({ createNotificationsqueryalertsRequestBody: { uuid, from, to, limit: QUERY_ALERTS_LIMIT } });
  }, [uuid, timestamp, queryAlerts]);

  const alerts = alertsData?.alerts ?? [];

  const firingAlerts = alerts.filter((alert) => alert.status === 'firing');
  const resolvedAlerts = alerts.filter((alert) => alert.status === 'resolved');

  return { alerts, firingAlerts, resolvedAlerts, isLoading };
}
