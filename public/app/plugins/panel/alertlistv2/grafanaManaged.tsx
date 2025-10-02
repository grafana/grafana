import { useMemo } from 'react';
import { useAsync } from 'react-use';

import { DataFrame, InterpolateFunction } from '@grafana/data';
import { BackendDataSourceResponse, config, getBackendSrv, toDataQueryResponse } from '@grafana/runtime';
import { alertSilencesApi } from 'app/features/alerting/unified/api/alertSilencesApi';
import { GRAFANA_RULES_SOURCE_NAME, getDatasourceAPIUid } from 'app/features/alerting/unified/utils/datasource';
import { rulesNav } from 'app/features/alerting/unified/utils/navigation';
import { isPromAlertingRuleState, PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { GrafanaAlertItem, StateFilter } from './types';
import { createFilter } from './utils';

interface GrafanaManagedAlertsProps {
  stateFilter: StateFilter;
  alertInstanceLabelFilter?: string;
  folder?: { uid: string; title: string } | null;
  replaceVariables: InterpolateFunction;
  enabled?: boolean;
  hideSilenced?: boolean;
}

type Labels = {
  alertname: string;
  alertstate: 'firing' | 'pending';
  grafana_folder: string;
  grafana_rule_uid: string;
};

const GRAFANA_ITEM_HEIGHT = 52;

function processGrafanaAlertFrames(alertRules: DataFrame[]): GrafanaAlertItem[] {
  if (!alertRules?.length) {
    return [];
  }

  const items: GrafanaAlertItem[] = [];

  for (const frame of alertRules) {
    const valueField = frame.fields.at(1);
    if (!valueField) {
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const labels = valueField?.labels as Labels;
    const { alertname = 'unknown', alertstate = PromAlertingRuleState.Unknown, grafana_rule_uid } = labels;

    const state = isPromAlertingRuleState(alertstate) ? alertstate : PromAlertingRuleState.Unknown;
    const ruleLink = rulesNav.detailsPageLink('grafana', { uid: grafana_rule_uid, ruleSourceName: 'grafana' });

    items.push({
      type: 'grafana',
      key: JSON.stringify(labels),
      name: alertname,
      href: ruleLink,
      state,
      namespace: labels.grafana_folder,
      itemHeight: GRAFANA_ITEM_HEIGHT,
    });
  }

  return items;
}

export function useGrafanaAlerts({
  stateFilter,
  alertInstanceLabelFilter,
  folder,
  replaceVariables,
  enabled = true,
  hideSilenced = false,
}: GrafanaManagedAlertsProps) {
  // Fetch silences for Grafana alertmanager if hideSilenced is enabled
  const datasourceUid = getDatasourceAPIUid(GRAFANA_RULES_SOURCE_NAME);
  const { data: silences } = alertSilencesApi.useGetSilencesQuery(
    { datasourceUid: datasourceUid ?? '' },
    { skip: !enabled || !hideSilenced || !datasourceUid }
  );

  // construct query filter
  const filter = useMemo(
    () =>
      createFilter(
        { stateFilter, folder, alertInstanceLabelFilter },
        replaceVariables,
        hideSilenced ? silences : undefined
      ),
    [folder, stateFilter, alertInstanceLabelFilter, replaceVariables, hideSilenced, silences]
  );

  const {
    value: alertRules,
    loading,
    error,
  } = useAsync(async (): Promise<DataFrame[]> => {
    if (!enabled) {
      return [];
    }
    const datasourceUID = config.unifiedAlerting.stateHistory?.prometheusTargetDatasourceUID;
    const metricName = config.unifiedAlerting.stateHistory?.prometheusMetricName || 'GRAFANA_ALERTS';

    if (!datasourceUID) {
      throw new Error('Prometheus datasource UID not configured for state history');
    }

    // Query Prometheus for GRAFANA_ALERTS metric
    const query = `group by (alertname, alertstate, grafana_rule_uid, grafana_folder) (${metricName}{${filter}})`;

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
  }, [filter, enabled]);

  const items = useMemo(() => processGrafanaAlertFrames(alertRules ?? []), [alertRules]);

  return { items, loading, error };
}
