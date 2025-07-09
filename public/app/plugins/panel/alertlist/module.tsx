import { PanelPlugin } from '@grafana/data';

import { GroupBy } from './GroupByWithLoading';
import { UnifiedAlertListPanel } from './UnifiedAlertList';
import { UnifiedAlertListOptions, ViewMode, GroupMode, SortOrder } from './types';

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
      path: 'stateFilter.normal',
      name: 'Normal',
      defaultValue: false,
      category: ['Alert state filter'],
    });
});

export const plugin = unifiedAlertList;
