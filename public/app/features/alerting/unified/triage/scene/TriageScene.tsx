import {
  CustomVariable,
  EmbeddedScene,
  FormatVariable,
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

import { summaryChart } from './SummaryChart';
import { WorkbenchSceneObject } from './Workbench';
import { DEFAULT_FIELDS, METRIC_NAME, defaultTimeRange, getQueryRunner } from './utils';

export const triageScene = new EmbeddedScene({
  $behaviors: [registerAlertsGroupByMacro, registerFilterExpressionMacro],
  controls: [
    new VariableValueSelectors({}),
    new SceneControlsSpacer(),
    new SceneTimePicker({}),
    new SceneRefreshPicker({}),
  ],
  $data: getTriageQuery(),
  $timeRange: new SceneTimeRange(defaultTimeRange),
  $variables: new SceneVariableSet({
    variables: [
      new CustomVariable({
        name: 'groupBy',
        isMulti: true,
        allowCustomValue: true,
        noValueOnClear: true,
      }),
    ],
  }),
  body: new SceneFlexLayout({
    direction: 'column',
    children: [
      // this is the summary bar chart we show above the workbench
      new SceneFlexItem({
        minHeight: 250,
        body: summaryChart,
      }),
      // this is the main workbench component
      new WorkbenchSceneObject({}),
    ],
  }),
});

export const TriageScene = () => <triageScene.Component model={triageScene} />;

function getTriageQuery(): SceneQueryRunner {
  return getQueryRunner(`count by ($\{__alertsGroupBy\}) (${METRIC_NAME}{$\{__promFilter.groupBy\}})`, {
    format: 'table',
  });
}

class AlertsGroupByMacro implements FormatVariable {
  public state: { name: string; type: string };

  constructor(
    name: string,
    private _context: SceneObject
  ) {
    this.state = { name, type: '__alertsGroupBy' };
  }

  public getValue(_fieldPath?: string) {
    const groupingFields = [...DEFAULT_FIELDS];

    const groupBy = sceneGraph.lookupVariable('groupBy', this._context);
    const groupByValues = groupBy?.getValue();

    if (Array.isArray(groupByValues)) {
      const validGroupByValues = groupByValues.filter((value): value is string => typeof value === 'string');
      groupingFields.push(...validGroupByValues);
    }

    return groupingFields.join(',');
  }

  getValueText?(fieldPath?: string): string {
    return '';
  }
}

function registerAlertsGroupByMacro() {
  const unregister = sceneUtils.registerVariableMacro('__alertsGroupBy', AlertsGroupByMacro);
  return () => unregister();
}

/**
 * This is a macro which converts a variable into a PromQL filter expression
 * The filter excludes series that don't have any values for the given variable.
 *
 * Example:
 * - groupBy: ['alertname', 'instance']
 * - __promFilter.groupBy: 'alertname,instance' -> 'alertname!="",instance!=""'
 *
 * Docs: https://grafana.com/developers/scenes/advanced-variables#custom-variable-macros
 */
class FilterExpressionMacro implements FormatVariable {
  public state: { name: string; type: string };

  constructor(
    name: string,
    private _context: SceneObject
  ) {
    this.state = { name, type: '__promFilter' };
  }

  public getValue(fieldPath?: string) {
    if (!fieldPath) {
      return undefined;
    }

    const filterBy = sceneGraph.lookupVariable(fieldPath, this._context);
    const filterByValues = filterBy?.getValue();

    if (!filterByValues) {
      return undefined;
    }

    if (Array.isArray(filterByValues)) {
      return filterByValues.map((key) => `${key}!=""`).join(',');
    }

    return `${filterByValues}!=""`;
  }

  getValueText?(fieldPath?: string): string {
    return '';
  }
}

function registerFilterExpressionMacro() {
  const unregister = sceneUtils.registerVariableMacro('__promFilter', FilterExpressionMacro);
  return () => unregister();
}
