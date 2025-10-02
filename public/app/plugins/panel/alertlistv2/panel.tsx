import { useMemo } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { VariableSizeList } from 'react-window';

import { PanelProps } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert } from '@grafana/ui';
import { AlertRuleListItem } from 'app/features/alerting/unified/rule-list/components/AlertRuleListItem';
import { AlertRuleListItemSkeleton } from 'app/features/alerting/unified/rule-list/components/AlertRuleListItemLoader';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';

import { useExternalAlerts } from './externalManaged';
import { useGrafanaAlerts } from './grafanaManaged';
import { AlertListPanelOptions, UnifiedAlertItem } from './types';

function AlertListPanel(props: PanelProps<AlertListPanelOptions>) {
  const { datasource, stateFilter, alertInstanceLabelFilter, folder, hideSilenced } = props.options;
  const { replaceVariables } = props;

  const shouldFetchGrafana = datasource.includes(GRAFANA_RULES_SOURCE_NAME);
  const grafanaResult = useGrafanaAlerts({
    stateFilter,
    alertInstanceLabelFilter,
    folder,
    replaceVariables,
    enabled: shouldFetchGrafana,
    hideSilenced,
  });

  const externalDatasources = datasource.filter((source) => source !== GRAFANA_RULES_SOURCE_NAME);
  const externalResults = useExternalAlerts({
    datasources: externalDatasources,
    stateFilter,
    alertInstanceLabelFilter,
    replaceVariables,
  });

  // Combine all items
  const allItems = useMemo<UnifiedAlertItem[]>(() => {
    const combined: UnifiedAlertItem[] = shouldFetchGrafana ? [...grafanaResult.items] : [];
    for (const result of externalResults) {
      combined.push(...result.items);
    }
    return combined;
  }, [shouldFetchGrafana, grafanaResult.items, externalResults]);

  if (datasource.length === 0) {
    return (
      <div>
        <Trans i18nKey="alertlist.panel.no-sources">No alert sources configured</Trans>
      </div>
    );
  }

  const loading = grafanaResult.loading || externalResults.some((r) => r.loading);
  const error = grafanaResult.error || externalResults.find((r) => r.error)?.error;

  // Handle loading state
  if (loading) {
    return (
      <>
        <AlertRuleListItemSkeleton />
        <AlertRuleListItemSkeleton />
        <AlertRuleListItemSkeleton />
      </>
    );
  }

  // Handle error state
  if (error) {
    return <Alert title={t('alertlist.error-title', 'Failed to fetch alerts')}>{stringifyErrorLike(error)}</Alert>;
  }

  // Handle empty state
  if (allItems.length === 0) {
    return (
      <div>
        <Trans i18nKey="alertlist.no-alerts">No alerts found</Trans>
      </div>
    );
  }

  // Render virtualized list
  return (
    <AutoSizer disableWidth>
      {({ height }) => (
        <VariableSizeList
          height={height}
          width="100%"
          itemCount={allItems.length}
          itemSize={(index) => allItems[index].itemHeight}
          overscanCount={5}
        >
          {({ index, style }) => {
            const item = allItems[index];
            return (
              <div style={{ ...style, whiteSpace: 'nowrap' }}>
                {item.type === 'grafana' ? (
                  <AlertRuleListItem
                    key={item.key}
                    name={item.name}
                    href={item.href}
                    application="grafana"
                    state={item.state}
                    namespace={item.namespace}
                    actions={<></>}
                  />
                ) : (
                  <AlertRuleListItem key={item.key} name={item.name} href={item.href} state={item.state} />
                )}
              </div>
            );
          }}
        </VariableSizeList>
      )}
    </AutoSizer>
  );
}

export { AlertListPanel };
