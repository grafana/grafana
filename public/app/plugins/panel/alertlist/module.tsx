import { type DataSourceInstanceSettings, PanelPlugin, standardEditorsRegistry, ThresholdsMode } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { BigValueColorMode, Button, Stack } from '@grafana/ui';
import { NestedFolderPicker } from 'app/core/components/NestedFolderPicker/NestedFolderPicker';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';

import {
  GRAFANA_DATASOURCE_NAME,
  SUPPORTED_RULE_SOURCE_TYPES,
} from '../../../features/alerting/unified/utils/datasource';

import { GroupBy } from './GroupByWithLoading';
import { UnifiedAlertListPanel } from './UnifiedAlertList';
import { GroupMode, SortOrder, STAT_THRESHOLDS_DEFAULT, type UnifiedAlertListOptions, ViewMode } from './types';

const unifiedAlertList = new PanelPlugin<UnifiedAlertListOptions>(UnifiedAlertListPanel)
  .setPanelOptions((builder) => {
    const optionsCategory = [t('alertlist.category-options', 'Options')];
    const filterCategory = [t('alertlist.category-filter', 'Filter')];
    const alertStateCategory = [t('alertlist.category-alert-state-filter', 'Alert state filter')];
    builder
      .addRadio({
        path: 'viewMode',
        name: t('alertlist.name-view-mode', 'View mode'),
        description: t('alertlist.description-view-mode', 'Toggle between list view and stat view'),
        defaultValue: ViewMode.List,
        settings: {
          options: [
            { label: t('alertlist.view-mode-options.label-list', 'List'), value: ViewMode.List },
            { label: t('alertlist.view-mode-options.label-stat', 'Stat'), value: ViewMode.Stat },
          ],
        },
        category: optionsCategory,
      })
      .addRadio({
        path: 'groupMode',
        name: t('alertlist.name-group-mode', 'Group mode'),
        description: t('alertlist.description-group-mode', 'How alert instances should be grouped'),
        defaultValue: GroupMode.Default,
        settings: {
          options: [
            {
              value: GroupMode.Default,
              label: t('alertlist.group-mode-options.label-default-grouping', 'Default grouping'),
            },
            {
              value: GroupMode.Custom,
              label: t('alertlist.group-mode-options.label-custom-grouping', 'Custom grouping'),
            },
          ],
        },
        category: optionsCategory,
      })
      .addCustomEditor({
        path: 'groupBy',
        name: t('alertlist.name-group-by', 'Group by'),
        description: t('alertlist.description-group-by', 'Filter alerts using label querying'),
        id: 'groupBy',
        defaultValue: [],
        showIf: (options) => options.groupMode === GroupMode.Custom,
        category: optionsCategory,
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
        name: t('alertlist.name-max-items', 'Max items'),
        path: 'maxItems',
        description: t('alertlist.description-max-items', 'Maximum alerts to display'),
        defaultValue: 20,
        showIf: (options) => options.groupMode !== GroupMode.Custom,
        category: optionsCategory,
      })
      .addSelect({
        name: t('alertlist.name-sort-order', 'Sort order'),
        path: 'sortOrder',
        description: t('alertlist.description-sort-order', 'Sort order of alerts and alert instances'),
        settings: {
          options: [
            {
              label: t('alertlist.sort-order-options.label-alphabetical-asc', 'Alphabetical (asc)'),
              value: SortOrder.AlphaAsc,
            },
            {
              label: t('alertlist.sort-order-options.label-alphabetical-desc', 'Alphabetical (desc)'),
              value: SortOrder.AlphaDesc,
            },
            { label: t('alertlist.sort-order-options.label-importance', 'Importance'), value: SortOrder.Importance },
            { label: t('alertlist.sort-order-options.label-time-asc', 'Time (asc)'), value: SortOrder.TimeAsc },
            { label: t('alertlist.sort-order-options.label-time-desc', 'Time (desc)'), value: SortOrder.TimeDesc },
          ],
        },
        defaultValue: SortOrder.AlphaAsc,
        category: optionsCategory,
      })
      .addBooleanSwitch({
        path: 'dashboardAlerts',
        name: t('alertlist.name-alerts-linked-to-dashboard', 'Alerts linked to this dashboard'),
        description: t('alertlist.descriptino-alerts-linked-to-dashboard', 'Only show alerts linked to this dashboard'),
        defaultValue: false,
        category: optionsCategory,
      })
      .addTextInput({
        path: 'alertName',
        name: t('alertlist.name-alert-name', 'Alert name'),
        description: t('alertlist.description-alert-name', 'Filter for alerts containing this text'),
        defaultValue: '',
        category: filterCategory,
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
      .addCustomEditor({
        path: 'datasource',
        name: t('alertlist.name-datasource', 'Datasource'),
        description: t('alertlist.description-datasource', 'Filter from alert source'),
        id: 'datasource',
        defaultValue: null,
        editor: function RenderDatasourcePicker({ id, ...props }) {
          return (
            <Stack gap={1}>
              <DataSourcePicker
                {...props}
                inputId={id}
                type={SUPPORTED_RULE_SOURCE_TYPES}
                noDefault
                current={props.value}
                onChange={(ds: DataSourceInstanceSettings) => {
                  if (ds.uid !== 'grafana') {
                    props.context.options.folder = null;
                  }
                  return props.onChange(ds.name);
                }}
              />
              <Button variant="secondary" onClick={() => props.onChange(null)}>
                <Trans i18nKey="alertlist.unified-alert-list.clear">Clear</Trans>
              </Button>
            </Stack>
          );
        },
        category: filterCategory,
      })
      .addCustomEditor({
        showIf: (options) => options.datasource === GRAFANA_DATASOURCE_NAME || !Boolean(options.datasource),
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
        category: filterCategory,
      })
      .addBooleanSwitch({
        path: 'showInactiveAlerts',
        name: t('alertlist.name-show-inactive-alerts', 'Show alerts with 0 instances'),
        description: t(
          'alertlist.description-show-inactive-alerts',
          'Include alert rules which have 0 (zero) instances. Because these rules have no instances, they remain hidden if the Alert instance label filter is configured.'
        ),
        defaultValue: false,
        category: filterCategory,
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
      .addBooleanSwitch({
        path: 'stateFilter.recovering',
        name: t('alertlist.name-recovering', 'Recovering'),
        defaultValue: true,
        category: alertStateCategory,
      })
      .addBooleanSwitch({
        path: 'stateFilter.noData',
        name: t('alertlist.name-no-data', 'No Data'),
        defaultValue: false,
        category: alertStateCategory,
      })
      .addBooleanSwitch({
        path: 'stateFilter.normal',
        name: t('alertlist.name-normal', 'Normal'),
        defaultValue: false,
        category: alertStateCategory,
      })
      .addBooleanSwitch({
        path: 'stateFilter.error',
        name: t('alertlist.name-error', 'Error'),
        defaultValue: true,
        category: alertStateCategory,
      });

    if (config.featureToggles.alertingAlertListPanelEnhancements) {
      const statCategory = [t('alertlist.category-stat-styles', 'Stat styles')];

      builder
        .addSelect({
          path: 'statColorMode',
          name: t('alertlist.name-stat-color-mode', 'Color mode'),
          description: t(
            'alertlist.description-stat-color-mode',
            'Control how the stat value or background is colored'
          ),
          defaultValue: BigValueColorMode.None,
          showIf: (options) => options.viewMode === ViewMode.Stat,
          settings: {
            options: [
              { value: BigValueColorMode.None, label: t('alertlist.stat-color-mode.label-none', 'None') },
              { value: BigValueColorMode.Value, label: t('alertlist.stat-color-mode.label-value', 'Value') },
              {
                value: BigValueColorMode.Background,
                label: t('alertlist.stat-color-mode.label-background-gradient', 'Background Gradient'),
              },
              {
                value: BigValueColorMode.BackgroundSolid,
                label: t('alertlist.stat-color-mode.label-background-solid', 'Background Solid'),
              },
            ],
          },
          category: statCategory,
        })
        .addCustomEditor({
          id: 'statThresholds',
          path: 'statThresholds',
          name: t('alertlist.name-stat-thresholds', 'Thresholds'),
          description: t(
            'alertlist.description-stat-thresholds',
            'Define thresholds to color the stat value based on the alert count'
          ),
          defaultValue: STAT_THRESHOLDS_DEFAULT,
          showIf: (options) => options.viewMode === ViewMode.Stat && options.statColorMode !== BigValueColorMode.None,
          editor: standardEditorsRegistry.get('thresholds').editor,
          category: statCategory,
        })
        .addCustomEditor({
          id: 'statValueMappings',
          path: 'statValueMappings',
          name: t('alertlist.name-stat-value-mappings', 'Value mappings'),
          description: t(
            'alertlist.description-stat-value-mappings',
            'Modify the display text based on the alert count'
          ),
          defaultValue: [],
          showIf: (options) => options.viewMode === ViewMode.Stat,
          editor: standardEditorsRegistry.get('mappings').editor,
          category: statCategory,
        });
    }
  })
  .setMigrationHandler((panel) => {
    if (!panel.options.statColorMode) {
      panel.options.statColorMode = BigValueColorMode.None;
    }
    if (!panel.options.statThresholds) {
      panel.options.statThresholds = {
        mode: ThresholdsMode.Absolute,
        steps: [
          { value: -Infinity, color: 'green' },
          { value: 80, color: 'red' },
        ],
      };
    }
    if (!panel.options.statValueMappings) {
      panel.options.statValueMappings = [];
    }

    return panel.options;
  });

export const plugin = unifiedAlertList;
