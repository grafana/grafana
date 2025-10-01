import { useMemo } from 'react';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeList } from 'react-window';

import { DataFrame, InterpolateFunction } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { BackendDataSourceResponse, config, getBackendSrv, toDataQueryResponse } from '@grafana/runtime';
import { Alert } from '@grafana/ui';
import { AlertRuleListItem } from 'app/features/alerting/unified/rule-list/components/AlertRuleListItem';
import { AlertRuleListItemSkeleton } from 'app/features/alerting/unified/rule-list/components/AlertRuleListItemLoader';
import { stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';
import { rulesNav } from 'app/features/alerting/unified/utils/navigation';
import { isPromAlertingRuleState, PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { StateFilter } from './types';
import { createFilter } from './utils';

interface GrafanaManagedAlertsProps {
  stateFilter: StateFilter;
  alertInstanceLabelFilter?: string;
  folder?: { uid: string; title: string } | null;
  replaceVariables: InterpolateFunction;
}

type Labels = {
  alertname: string;
  alertstate: 'firing' | 'pending';
  grafana_folder: string;
  grafana_rule_uid: string;
};

interface GrafanaAlertListItem {
  key: string;
  name: string;
  href: string;
  state: PromAlertingRuleState;
  namespace: string;
}

function processGrafanaAlertFrames(alertRules: DataFrame[]): GrafanaAlertListItem[] {
  if (!alertRules?.length) {
    return [];
  }

  const items: GrafanaAlertListItem[] = [];

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
      key: JSON.stringify(labels),
      name: alertname,
      href: ruleLink,
      state,
      namespace: labels.grafana_folder,
    });
  }

  return items;
}

export function GrafanaManagedAlerts({
  stateFilter,
  alertInstanceLabelFilter,
  folder,
  replaceVariables,
}: GrafanaManagedAlertsProps) {
  // construct query filter
  const filter = useMemo(
    () => createFilter({ stateFilter, folder, alertInstanceLabelFilter }, replaceVariables),
    [folder, stateFilter, alertInstanceLabelFilter, replaceVariables]
  );

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
  }, [filter]);

  // Prepare alert items for virtualization (must be before early returns to avoid conditional hooks)
  const alertItems = useMemo(() => processGrafanaAlertFrames(alertRules ?? []), [alertRules]);

  // Now handle loading and error states after all hooks
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
    return (
      <Alert title={t('alertlist.grafana.error-title', 'Failed to fetch Grafana alerts')}>
        {stringifyErrorLike(error)}
      </Alert>
    );
  }

  if (!alertItems.length) {
    return (
      <div>
        <Trans i18nKey="alertlist.grafana.no-alerts">No Grafana alerts found</Trans>
      </div>
    );
  }

  const ITEM_HEIGHT = 52; // Height of each AlertRuleListItem

  return (
    <AutoSizer disableWidth>
      {({ height }) => (
        <FixedSizeList
          height={height}
          width="100%"
          itemCount={alertItems.length}
          itemSize={ITEM_HEIGHT}
          overscanCount={5}
        >
          {({ index, style }) => {
            const item = alertItems[index];
            return (
              <div style={style}>
                <AlertRuleListItem
                  key={item.key}
                  name={item.name}
                  href={item.href}
                  application="grafana"
                  state={item.state}
                  namespace={item.namespace}
                  actions={<></>}
                />
              </div>
            );
          }}
        </FixedSizeList>
      )}
    </AutoSizer>
  );
}
