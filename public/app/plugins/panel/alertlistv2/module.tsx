import { PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';
import { GrafanaRulesSourceSymbol } from 'app/types/unified-alerting';

import { AlertListPanel } from './panel';
import { AlertListPanelOptions } from './types';

const unifiedAlertList = new PanelPlugin<AlertListPanelOptions>(AlertListPanel).setPanelOptions((builder) => {
  const alertStateCategory = [t('alertlist.category-alert-state-filter', 'Alert state filter')];

  builder
    // @TODO check if Grafana is always selected as the default
    .addMultiSelect({
      name: t('alertlist.source', 'Source'),
      description: t('alertlist.description-source', 'Search for alerts in these sources'),
      path: 'datasource',
      defaultValue: GrafanaRulesSourceSymbol['description'],
      settings: {
        options: [{ label: 'Grafana', value: GrafanaRulesSourceSymbol['description'] }],
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
