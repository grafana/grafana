import React from 'react';

import {
  SceneObjectState,
  SceneObjectBase,
  SceneComponentProps,
  PanelBuilders,
  SceneFlexItem,
  SceneFlexLayout,
  SceneQueryRunner,
  SceneVariableSet,
  QueryVariable,
  sceneGraph,
  VariableDependencyConfig,
  SceneVariable,
  VariableValueOption,
} from '@grafana/scenes';
import { VariableHide } from '@grafana/schema';
import { Button } from '@grafana/ui';

import {
  getVariablesWithMetricConstant,
  MetricSelectedEvent,
  trailsDS,
  VAR_FILTERS,
  VAR_FILTERS_EXPR,
  VAR_METRIC,
  VAR_METRIC_EXPR,
  VAR_METRIC_NAMES,
} from './shared';

export interface MetricSelectLayoutState extends SceneObjectState {
  body: SceneFlexLayout;
}

export class MetricSelectLayout extends SceneObjectBase<MetricSelectLayoutState> {
  constructor(state: Partial<MetricSelectLayoutState>) {
    super({
      $variables: getMetricNamesVariableSet(),
      body: state.body ?? new SceneFlexLayout({ children: [], wrap: 'wrap' }),
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_FILTERS, VAR_METRIC_NAMES],
    onVariableUpdatesCompleted: this._onVariableChanged.bind(this),
  });

  private _onVariableChanged(changedVariables: Set<SceneVariable>, dependencyChanged: boolean): void {
    for (const variable of changedVariables) {
      if (variable.state.name === VAR_FILTERS) {
        const variable = sceneGraph.lookupVariable(VAR_FILTERS, this)!;
        // Temp hack
        (this.state.$variables as any)._handleVariableValueChanged(variable);
      }

      if (variable.state.name === VAR_METRIC_NAMES && variable instanceof QueryVariable) {
        this.buildLayout(variable.state.options);
      }
    }
  }

  private _onActivate() {
    const variable = sceneGraph.lookupVariable(VAR_METRIC_NAMES, this);

    if (variable instanceof QueryVariable && !variable.state.loading) {
      this.buildLayout(variable.state.options);
    }
  }

  private buildLayout(metricNames: VariableValueOption[]) {
    const children: SceneFlexItem[] = [];

    for (const metric of metricNames) {
      const metricName = String(metric.value);
      children.push(
        new SceneFlexItem({
          minHeight: 150,
          minWidth: 370,
          $variables: getVariablesWithMetricConstant(metricName),
          body: getPanelForMetric(metricName),
        })
      );

      if (children.length > 5) {
        break;
      }
    }

    this.state.body.setState({ children });
  }

  public static Component = ({ model }: SceneComponentProps<MetricSelectLayout>) => {
    return <model.state.body.Component model={model.state.body} />;
  };
}

function getMetricNamesVariableSet() {
  return new SceneVariableSet({
    variables: [
      new QueryVariable({
        name: VAR_METRIC_NAMES,
        datasource: trailsDS,
        hide: VariableHide.hideVariable,
        includeAll: true,
        defaultToAll: true,
        skipUrlSync: true,
        query: { query: 'label_values({$filters},__name__)', refId: 'A' },
      }),
    ],
  });
}

function getPanelForMetric(metric: string) {
  return PanelBuilders.timeseries()
    .setTitle('$metric')
    .setData(
      new SceneQueryRunner({
        datasource: trailsDS,
        maxDataPoints: 300,
        queries: [
          { expr: `sum(rate(${VAR_METRIC_EXPR}${VAR_FILTERS_EXPR}[$__rate_interval]))`, range: true, refId: 'A' },
        ],
      })
    )
    .setOption('legend', { showLegend: false })
    .setCustomFieldConfig('fillOpacity', 9)
    .setHeaderActions(new SelectMetricAction({}))
    .build();
}

export interface SelectMetricActionState extends SceneObjectState {}

export class SelectMetricAction extends SceneObjectBase<SelectMetricActionState> {
  public onClick = () => {
    const metric = sceneGraph.interpolate(this, VAR_METRIC_EXPR);
    this.publishEvent(new MetricSelectedEvent(metric), true);
  };

  public static Component = ({ model }: SceneComponentProps<SelectMetricAction>) => {
    return (
      <Button variant="primary" size="sm" fill="text" onClick={model.onClick}>
        Select
      </Button>
    );
  };
}
