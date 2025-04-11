import { DataSourceInstanceSettings, PanelPlugin } from '@grafana/data';
import { Button, Stack } from '@grafana/ui';
import { NestedFolderPicker } from 'app/core/components/NestedFolderPicker/NestedFolderPicker';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';

import {
  GRAFANA_DATASOURCE_NAME,
  SUPPORTED_RULE_SOURCE_TYPES,
} from '../../../features/alerting/unified/utils/datasource';

import { GroupBy } from './GroupByWithLoading';
import { UnifiedAlertListPanel } from './UnifiedAlertList';
import { GroupMode, SortOrder, UnifiedAlertListOptions, ViewMode } from './types';

const unifiedAlertList = new PanelPlugin<UnifiedAlertListOptions>(UnifiedAlertListPanel).setPanelOptions((builder) => {
  builder
    .addRadio({
      path: 'viewMode',
      name: 'View mode',
      description: 'Toggle between list view and stat view',
      defaultValue: ViewMode.List,
      settings: {
        options: [
          { label: 'List', value: ViewMode.List },
          { label: 'Stat', value: ViewMode.Stat },
        ],
      },
      category: ['Options'],
    })
    .addRadio({
      path: 'groupMode',
      name: 'Group mode',
      description: 'How alert instances should be grouped',
      defaultValue: GroupMode.Default,
      settings: {
        options: [
          { value: GroupMode.Default, label: 'Default grouping' },
          { value: GroupMode.Custom, label: 'Custom grouping' },
        ],
      },
      category: ['Options'],
    })
    .addCustomEditor({
      path: 'groupBy',
      name: 'Group by',
      description: 'Filter alerts using label querying',
      id: 'groupBy',
      defaultValue: [],
      showIf: (options) => options.groupMode === GroupMode.Custom,
      category: ['Options'],
      editor: (props) => {
        return (
          <GroupBy
            id={props.id ?? 'groupBy'}
            defaultValue={props.value.map((value: string) => ({ label: value, value }))}
            onChange={props.onChange}
            dataSource={props.context.options.datasource}
          />
        );
      },
    })
    .addNumberInput({
      name: 'Max items',
      path: 'maxItems',
      description: 'Maximum alerts to display',
      defaultValue: 20,
      category: ['Options'],
    })
    .addSelect({
      name: 'Sort order',
      path: 'sortOrder',
      description: 'Sort order of alerts and alert instances',
      settings: {
        options: [
          { label: 'Alphabetical (asc)', value: SortOrder.AlphaAsc },
          { label: 'Alphabetical (desc)', value: SortOrder.AlphaDesc },
          { label: 'Importance', value: SortOrder.Importance },
          { label: 'Time (asc)', value: SortOrder.TimeAsc },
          { label: 'Time (desc)', value: SortOrder.TimeDesc },
        ],
      },
      defaultValue: SortOrder.AlphaAsc,
      category: ['Options'],
    })
    .addBooleanSwitch({
      path: 'dashboardAlerts',
      name: 'Alerts linked to this dashboard',
      description: 'Only show alerts linked to this dashboard',
      defaultValue: false,
      category: ['Options'],
    })
    .addTextInput({
      path: 'alertName',
      name: 'Alert name',
      description: 'Filter for alerts containing this text',
      defaultValue: '',
      category: ['Filter'],
    })
    .addTextInput({
      path: 'alertInstanceLabelFilter',
      name: 'Alert instance label',
      description: 'Filter alert instances using label querying, ex: {severity="critical", instance=~"cluster-us-.+"}',
      defaultValue: '',
      category: ['Filter'],
    })
    .addCustomEditor({
      path: 'datasource',
      name: 'Datasource',
      description: 'Filter from alert source',
      id: 'datasource',
      defaultValue: null,
      editor: function RenderDatasourcePicker(props) {
        return (
          <Stack gap={1}>
            <DataSourcePicker
              {...props}
              type={SUPPORTED_RULE_SOURCE_TYPES}
              noDefault
              current={props.value}
              onChange={(ds: DataSourceInstanceSettings) => {
                // If we're changing the datasource, clear the folder selection
                // as otherwise we might still be accidentally filtering out alerts
                if (ds.uid !== 'grafana') {
                  props.context.options.folder = null;
                }
                return props.onChange(ds.name);
              }}
            />
            <Button variant="secondary" onClick={() => props.onChange(null)}>
              Clear
            </Button>
          </Stack>
        );
      },
      category: ['Filter'],
    })
    .addCustomEditor({
      showIf: (options) => options.datasource === GRAFANA_DATASOURCE_NAME || !Boolean(options.datasource),
      path: 'folder',
      name: 'Folder',
      description: 'Filter for alerts in the selected folder (for Grafana-managed alert rules only)',
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
      category: ['Filter'],
    })
    .addBooleanSwitch({
      path: 'showInactiveAlerts',
      name: 'Show alerts with 0 instances',
      description:
        'Include alert rules which have 0 (zero) instances. Because these rules have no instances, they remain hidden if the Alert instance label filter is configured.',
      defaultValue: false,
      category: ['Filter'],
    })
    .addBooleanSwitch({
      path: 'stateFilter.firing',
      name: 'Alerting / Firing',
      defaultValue: true,
      category: ['Alert state filter'],
    })
    .addBooleanSwitch({
      path: 'stateFilter.pending',
      name: 'Pending',
      defaultValue: true,
      category: ['Alert state filter'],
    })
    .addBooleanSwitch({
      path: 'stateFilter.recovering',
      name: 'Recovering',
      defaultValue: true,
      category: ['Alert state filter'],
    })
    .addBooleanSwitch({
      path: 'stateFilter.noData',
      name: 'No Data',
      defaultValue: false,
      category: ['Alert state filter'],
    })
    .addBooleanSwitch({
      path: 'stateFilter.normal',
      name: 'Normal',
      defaultValue: false,
      category: ['Alert state filter'],
    })
    .addBooleanSwitch({
      path: 'stateFilter.error',
      name: 'Error',
      defaultValue: true,
      category: ['Alert state filter'],
    });
});

export const plugin = unifiedAlertList;
