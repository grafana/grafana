import { PanelPlugin, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { NestedFolderPicker } from 'app/core/components/NestedFolderPicker/NestedFolderPicker';
import { getRulesDataSources, GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';

import { AlertListPanel } from './panel';
import { AlertListPanelOptions } from './types';

const unifiedAlertList = new PanelPlugin<AlertListPanelOptions>(AlertListPanel).setPanelOptions((builder) => {
  const alertStateCategory = [t('alertlist.category-alert-state-filter', 'Alert state filter')];
  const filterCategory = [t('alertlist.category-filter', 'Filter')];
  const sourceFilter = [t('alertlist.source-filter', 'Source')];

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
      category: sourceFilter,
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
    })
    .addTextInput({
      path: 'alertInstanceLabelFilter',
      name: t('alertlist.name-alert-instance-label', 'Alert instance label'),
      description: t(
        'alertlist.description-alert-instance-label',
        'Filter alert instances using label querying, ex: {severity="critical", instance=~"cluster-us-.+"}'
      ),
      defaultValue: '',
      category: filterCategory,
    })
    .addBooleanSwitch({
      path: 'hideSilenced',
      name: t('alertlist.name-hide-silenced', 'Hide silenced'),
      description: t(
        'alertlist.description-hide-silenced',
        'Hide alert rules that match an active silence (Grafana-managed only)'
      ),
      defaultValue: false,
      category: filterCategory,
      showIf: (options) => options.datasource.includes(GRAFANA_RULES_SOURCE_NAME),
    })
    .addCustomEditor({
      showIf: (options) => options.datasource.includes(GRAFANA_RULES_SOURCE_NAME),
      path: 'folder',
      name: t('alertlist.name-folder', 'Folder'),
      description: t(
        'alertlist.description-folder',
        'Filter for alerts in the selected folder (for Grafana-managed alert rules only)'
      ),
      id: 'folder',
      defaultValue: null,
      editor: function RenderFolderPicker(props) {
        return (
          <NestedFolderPicker
            clearable
            showRootFolder={false}
            {...props}
            onChange={(uid, title) => props.onChange({ uid, title })}
            value={props.value?.uid}
            permission="view"
          />
        );
      },
      category: sourceFilter,
    });
});

export const plugin = unifiedAlertList;
