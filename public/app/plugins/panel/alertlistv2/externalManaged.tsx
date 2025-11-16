import { useMemo } from 'react';
import { useAsync } from 'react-use';

import { DataFrame, InterpolateFunction } from '@grafana/data';
import { BackendDataSourceResponse, getBackendSrv, toDataQueryResponse } from '@grafana/runtime';
import { getRulesDataSourceByUID } from 'app/features/alerting/unified/utils/datasource';
import { escapePathSeparators } from 'app/features/alerting/unified/utils/rule-id';
import { createRelativeUrl } from 'app/features/alerting/unified/utils/url';
import { isPromAlertingRuleState, PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { ExternalAlertItem, StateFilter } from './types';
import { createFilter } from './utils';

interface ExternalManagedAlertsProps {
  datasources: string[];
  stateFilter: StateFilter;
  alertInstanceLabelFilter?: string;
  replaceVariables: InterpolateFunction;
}

type Labels = {
  alertname: string;
  alertstate: 'firing' | 'pending';
};

const metricName = 'ALERTS';
const EXTERNAL_ITEM_HEIGHT = 52;

function processAlertFrames(alertRules: DataFrame[], datasourceName?: string): ExternalAlertItem[] {
  if (!alertRules?.length) {
    return [];
  }

  const items: ExternalAlertItem[] = [];

  for (const frame of alertRules) {
    const valueField = frame.fields.at(1);
    if (!valueField) {
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const labels = valueField?.labels as Labels;
    const { alertname = 'unknown', alertstate = PromAlertingRuleState.Unknown } = labels;
    const state = isPromAlertingRuleState(alertstate) ? alertstate : PromAlertingRuleState.Unknown;

    // Create link to rule find page using datasource name and rule name
    const ruleLink =
      datasourceName && alertname
        ? createRelativeUrl(
            `/alerting/${encodeURIComponent(datasourceName)}/${encodeURIComponent(escapePathSeparators(alertname))}/find`
          )
        : '#';

    items.push({
      type: 'external',
      key: JSON.stringify(labels),
      name: alertname,
      href: ruleLink,
      state,
      itemHeight: EXTERNAL_ITEM_HEIGHT,
    });
  }

  return items;
}

export function useExternalAlerts({
  datasources,
  stateFilter,
  alertInstanceLabelFilter,
  replaceVariables,
}: ExternalManagedAlertsProps) {
  // construct query filter
  const filter = useMemo(
    () => createFilter({ stateFilter, alertInstanceLabelFilter }, replaceVariables),
    [stateFilter, alertInstanceLabelFilter, replaceVariables]
  );

  // Stabilize datasources array reference
  const datasourcesKey = datasources.join(',');

  const results = useAsync(async () => {
    if (datasources.length === 0) {
      return [];
    }

    const allResults = await Promise.all(
      datasources.map(async (datasourceUID) => {
        try {
          const datasource = getRulesDataSourceByUID(datasourceUID);
          const datasourceName = datasource?.name;

          // Query Prometheus for ALERTS metric
          const query = `group by (alertname, alertstate) (${metricName}{${filter}})`;

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
          const frames = dataQueryResponse.data ?? [];
          return processAlertFrames(frames, datasourceName);
        } catch (err) {
          console.error(`Error fetching alerts from datasource ${datasourceUID}:`, err);
          return [];
        }
      })
    );

    return allResults;
  }, [datasourcesKey, filter]);

  const items = useMemo(() => {
    if (!results.value) {
      return [];
    }
    return results.value.flat();
  }, [results.value]);

  return [{ items, loading: results.loading, error: results.error }];
}
