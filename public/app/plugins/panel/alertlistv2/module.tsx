import { PanelPlugin, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getRulesDataSources, GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';

import { AlertListPanel } from './panel';
import { AlertListPanelOptions } from './types';

const unifiedAlertList = new PanelPlugin<AlertListPanelOptions>(AlertListPanel).setPanelOptions((builder) => {
  const alertStateCategory = [t('alertlist.category-alert-state-filter', 'Alert state filter')];

  const grafanaOption: SelectableValue<string> = { label: 'Grafana', value: GRAFANA_RULES_SOURCE_NAME };
  const externalOptions: SelectableValue[] = getRulesDataSources().map((source) => ({
    label: source.name,
    value: source.uid,
  }));

  const dataSourceOptions = [grafanaOption, ...externalOptions];

  builder
    // @TODO check if Grafana is always selected as the default
    .addMultiSelect({
      name: t('alertlist.source', 'Source'),
      description: t('alertlist.description-source', 'Search for alerts in these sources'),
      path: 'datasource',
      defaultValue: [grafanaOption.value],
      settings: {
        options: dataSourceOptions,
        isClearable: true,
      },
    })
    .addBooleanSwitch({
      path: 'stateFilter.firing',
      name: t('alertlist.name-firing', 'Alerting / Firing'),
      defaultValue: true,
      category: alertStateCategory,
    })
    .addBooleanSwitch({
      path: 'stateFilter.pending',
      name: t('alertlist.name-pending', 'Pending'),
      defaultValue: true,
      category: alertStateCategory,
    });
});

export const plugin = unifiedAlertList;
