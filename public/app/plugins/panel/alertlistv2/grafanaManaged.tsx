import { useEffect } from 'react';
import { useAsync } from 'react-use';

import { DataFrame } from '@grafana/data';
import { BackendDataSourceResponse, config, getBackendSrv, toDataQueryResponse } from '@grafana/runtime';
import { Alert, Button, Icon, Stack } from '@grafana/ui';
import { AlertRuleListItem } from 'app/features/alerting/unified/rule-list/components/AlertRuleListItem';
import { AlertRuleListItemSkeleton } from 'app/features/alerting/unified/rule-list/components/AlertRuleListItemLoader';
import { stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';
import { isPromAlertingRuleState, PromAlertingRuleState } from 'app/types/unified-alerting-dto';

interface GrafanaManagedAlertsProps {}

type Labels = {
  alertname: string;
  alertstate: 'firing' | 'pending';
  grafana_folder: string;
};

export function GrafanaManagedAlerts({}: GrafanaManagedAlertsProps) {
  const {
    value: alertRules,
    loading,
    error,
  } = useAsync(async (): Promise<DataFrame[]> => {
    const datasourceUID = config.unifiedAlerting.stateHistory?.prometheusTargetDatasourceUID;
    const metricName = config.unifiedAlerting.stateHistory?.prometheusMetricName || 'GRAFANA_ALERTS';

    if (!datasourceUID) {
      throw new Error('Prometheus datasource UID not configured for state history');
    }

    // Query Prometheus for GRAFANA_ALERTS metric
    const query = `group by (alertname, alertstate, grafana_rule_uid, grafana_folder) (${metricName}{})`;

    const now = Date.now();
    const queries = [
      {
        refId: 'A',
        expr: query,
        instant: true,
        datasource: {
          type: 'prometheus',
          uid: datasourceUID,
        },
      },
    ];

    const data = await getBackendSrv().post<BackendDataSourceResponse>(
      '/api/ds/query',
      {
        from: (now - 3600000).toString(),
        to: now.toString(),
        queries,
        instant: true,
      },
      {
        params: {
          ds_type: 'prometheus',
        },
      }
    );

    const dataQueryResponse = toDataQueryResponse({ data }, queries);
    return dataQueryResponse.data ?? [];
  }, []);

  if (loading) {
    return (
      <>
        <AlertRuleListItemSkeleton />
        <AlertRuleListItemSkeleton />
        <AlertRuleListItemSkeleton />
      </>
    );
  }

  if (error) {
    return <Alert title="Failed to fetch Grafana alerts">{stringifyErrorLike(error)}</Alert>;
  }

  return (
    <>
      {alertRules?.length ? (
        <div>
          {alertRules.map((frame) => {
            const valueField = frame.fields.at(1);
            const labels: Labels = valueField?.labels;

            const { alertname = 'unknown', alertstate = PromAlertingRuleState.Unknown } = labels;

            const state = isPromAlertingRuleState(alertstate) ? alertstate : PromAlertingRuleState.Unknown;

            const key = JSON.stringify(labels);
            return (
              <AlertRuleListItem
                key={key}
                name={alertname}
                href={'#'}
                application="grafana"
                state={state}
                namespace={labels.grafana_folder}
                actions={
                  <Button variant="secondary" size="sm">
                    View rule
                  </Button>
                }
              />
            );
          })}
        </div>
      ) : (
        <div>No Grafana alerts found</div>
      )}
    </>
  );
}
