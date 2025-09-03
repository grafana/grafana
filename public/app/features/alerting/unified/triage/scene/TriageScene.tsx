import {
  AdHocFiltersVariable,
  FormatVariable,
  GroupByVariable,
  SceneControlsSpacer,
  SceneFlexItem,
  SceneFlexLayout,
  SceneObject,
  SceneQueryRunner,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  SceneVariableSet,
  VariableValueSelectors,
  sceneGraph,
  sceneUtils,
} from '@grafana/scenes';
import { EmbeddedSceneWithContext } from '@grafana/scenes-react';

import { SummaryChartScene } from './SummaryChart';
import { WorkbenchSceneObject } from './Workbench';
import { DEFAULT_FIELDS, DS_UID, defaultTimeRange } from './utils';

export const triageScene = new EmbeddedSceneWithContext({
  $behaviors: [],
  controls: [
    new VariableValueSelectors({}),
    new SceneControlsSpacer(),
    new SceneTimePicker({}),
    new SceneRefreshPicker({}),
  ],
  $timeRange: new SceneTimeRange(defaultTimeRange),
  $variables: new SceneVariableSet({
    variables: [
      new GroupByVariable({
        name: 'groupBy',
        label: 'Group by',
        datasource: {
          type: 'prometheus',
          uid: DS_UID,
        },
        allowCustomValue: true,
        applyMode: 'auto',
      }),
      new AdHocFiltersVariable({
        name: 'filters',
        label: 'Filters',
        datasource: {
          type: 'prometheus',
          uid: DS_UID,
        },
        applyMode: 'manual',
        allowCustomValue: true,
        useQueriesAsFilterForOptions: true,
        supportsMultiValueOperators: true,
        filters: [],
        baseFilters: [],
        layout: 'combobox',
      }),
    ],
  }),
  body: new SceneFlexLayout({
    direction: 'column',
    children: [
      // this is the summary bar chart we show above the workbench
      new SceneFlexItem({
        height: 250,
        body: new SummaryChartScene({}),
      }),
      // this is the main workbench component
      new WorkbenchSceneObject({}),
    ],
  }),
});

export const TriageScene = () => <triageScene.Component model={triageScene} />;

class AlertsGroupByMacro implements FormatVariable {
  public state: { name: string; type: string };

  constructor(
    name: string,
    private _context: SceneObject
  ) {
    this.state = { name, type: '__alertsGroupBy' };
  }

  public getValue(fieldPath?: string) {
    if (fieldPath === 'filters') {
      return this.getGroupByKeys()
        .map((key) => `${key}!=""`)
        .join(',');
    }

    const customGroupByKeys = this.getGroupByKeys();
    return DEFAULT_FIELDS.concat(customGroupByKeys).join(',');
  }

  getValueText?(fieldPath?: string): string {
    return '';
  }

  getGroupByKeys(): string[] {
    const groupBy = sceneGraph.lookupVariable('groupBy', this._context);
    const groupByValues = groupBy?.getValue();

    const groupByKeys = [];
    if (Array.isArray(groupByValues)) {
      const validGroupByValues = groupByValues.filter((value): value is string => typeof value === 'string');
      // Add only new fields that aren't already in DEFAULT_FIELDS
      const newFields = validGroupByValues.filter((field) => !DEFAULT_FIELDS.includes(field));
      groupByKeys.push(...newFields);
    }

    return groupByKeys;
  }
}

function registerAlertsGroupByMacro() {
  const unregister = sceneUtils.registerVariableMacro('__alertsGroupBy', AlertsGroupByMacro);
  return () => unregister();
}
