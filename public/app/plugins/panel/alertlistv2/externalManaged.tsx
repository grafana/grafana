import { useMemo } from 'react';
import { useAsync } from 'react-use';

import { DataFrame, InterpolateFunction } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { BackendDataSourceResponse, getBackendSrv, toDataQueryResponse } from '@grafana/runtime';
import { Alert } from '@grafana/ui';
import { AlertRuleListItem } from 'app/features/alerting/unified/rule-list/components/AlertRuleListItem';
import { AlertRuleListItemSkeleton } from 'app/features/alerting/unified/rule-list/components/AlertRuleListItemLoader';
import { getRulesDataSourceByUID } from 'app/features/alerting/unified/utils/datasource';
import { createShareLink, stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';
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

const metricName = 'ALERTS';

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
      <Alert title={t('alertlist.external.error-title', 'Failed to fetch Grafana alerts')}>
        {stringifyErrorLike(error)}
      </Alert>
    );
  }

  return (
    <>
      {alertRules?.length ? (
        <div>
          {alertRules.map((frame) => {
            const valueField = frame.fields.at(1);

            if (!valueField) {
              return;
            }

            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            const labels = valueField?.labels as Labels;

            const { alertname = 'unknown', alertstate = PromAlertingRuleState.Unknown } = labels;

            const state = isPromAlertingRuleState(alertstate) ? alertstate : PromAlertingRuleState.Unknown;

            // Create link to rule find page using datasource name and rule name
            const ruleLink = createRelativeUrl(
              `/alerting/${encodeURIComponent(datasourceName!)}/${encodeURIComponent(escapePathSeparators(alertname))}/find`
            );

            const key = JSON.stringify(labels);
            return <AlertRuleListItem key={key} name={alertname} href={ruleLink ?? '#'} state={state} />;
          })}
        </div>
      ) : (
        <div>
          <Trans i18nKey="alertlist.external.no-alerts">No alerts found</Trans>
        </div>
      )}
    </>
  );
}
