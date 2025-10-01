import { useMemo } from 'react';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeList } from 'react-window';

import { DataFrame, InterpolateFunction } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { BackendDataSourceResponse, getBackendSrv, toDataQueryResponse } from '@grafana/runtime';
import { Alert } from '@grafana/ui';
import { AlertRuleListItem } from 'app/features/alerting/unified/rule-list/components/AlertRuleListItem';
import { AlertRuleListItemSkeleton } from 'app/features/alerting/unified/rule-list/components/AlertRuleListItemLoader';
import { getRulesDataSourceByUID } from 'app/features/alerting/unified/utils/datasource';
import { stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';
import { escapePathSeparators } from 'app/features/alerting/unified/utils/rule-id';
import { createRelativeUrl } from 'app/features/alerting/unified/utils/url';
import { isPromAlertingRuleState, PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { StateFilter } from './types';
import { createFilter } from './utils';

interface ExternalManagedAlertsProps {
  datasourceUID: string;
  stateFilter: StateFilter;
  alertInstanceLabelFilter?: string;
  replaceVariables: InterpolateFunction;
}

type Labels = {
  alertname: string;
  alertstate: 'firing' | 'pending';
};

interface AlertListItem {
  key: string;
  name: string;
  href: string;
  state: PromAlertingRuleState;
}

const metricName = 'ALERTS';

function processAlertFrames(alertRules: DataFrame[], datasourceName?: string): AlertListItem[] {
  if (!alertRules?.length) {
    return [];
  }

  const items: AlertListItem[] = [];

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
      key: JSON.stringify(labels),
      name: alertname,
      href: ruleLink,
      state,
    });
  }

  return items;
}

export function ExternalManagedAlerts({
  datasourceUID,
  stateFilter,
  alertInstanceLabelFilter,
  replaceVariables,
}: ExternalManagedAlertsProps) {
  // Get datasource name from UID for creating links
  const datasource = useMemo(() => getRulesDataSourceByUID(datasourceUID), [datasourceUID]);
  const datasourceName = datasource?.name;

  // construct query filter
  const filter = useMemo(
    () => createFilter({ stateFilter, alertInstanceLabelFilter }, replaceVariables),
    [stateFilter, alertInstanceLabelFilter, replaceVariables]
  );

  const {
    value: alertRules,
    loading,
    error,
  } = useAsync(async (): Promise<DataFrame[]> => {
    if (!datasourceUID) {
      throw new Error('Prometheus datasource UID not configured for state history');
    }

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
    return dataQueryResponse.data ?? [];
  }, [datasourceUID, filter]);

  const alertItems = useMemo(() => processAlertFrames(alertRules ?? [], datasourceName), [alertRules, datasourceName]);

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
      <Alert title={t('alertlist.external.error-title', 'Failed to fetch alerts')}>{stringifyErrorLike(error)}</Alert>
    );
  }

  if (!alertItems.length) {
    return (
      <div>
        <Trans i18nKey="alertlist.external.no-alerts">No alerts found</Trans>
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
                <AlertRuleListItem key={item.key} name={item.name} href={item.href} state={item.state} />
              </div>
            );
          }}
        </FixedSizeList>
      )}
    </AutoSizer>
  );
}
