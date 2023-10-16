import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
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
} from '@grafana/scenes';
import { VariableHide } from '@grafana/schema';
import { Button, Input, Text, useStyles2, InlineSwitch } from '@grafana/ui';
import { Flex } from '@grafana/ui/src/unstable';

import {
  getVariablesWithMetricConstant,
  MetricSelectedEvent,
  trailsDS,
  VAR_FILTERS,
  VAR_FILTERS_EXPR,
  VAR_METRIC_EXPR,
  VAR_METRIC_NAMES,
} from './shared';

export interface MetricSelectLayoutState extends SceneObjectState {
  body: SceneFlexLayout;
  showHeading?: boolean;
  searchQuery?: string;
  showPreviews?: boolean;
}

export class MetricSelectLayout extends SceneObjectBase<MetricSelectLayoutState> {
  constructor(state: Partial<MetricSelectLayoutState>) {
    super({
      $variables: getMetricNamesVariableSet(),
      body: state.body ?? new SceneFlexLayout({ children: [], wrap: 'wrap' }),
      ...state,
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

      if (variable.state.name === VAR_METRIC_NAMES) {
        this.buildLayout();
      }
    }
  }

  private _onActivate() {
    this.buildLayout();
  }

  private buildLayout() {
    const variable = sceneGraph.lookupVariable(VAR_METRIC_NAMES, this);

    if (!(variable instanceof QueryVariable)) {
      return;
    }

    if (variable.state.loading) {
      return;
    }

    const searchRegex = new RegExp(this.state.searchQuery ?? '.*');
    const metricNames = variable.state.options;
    const children: SceneFlexItem[] = [];

    for (const metric of metricNames) {
      const metricName = String(metric.value);
      if (!metricName.match(searchRegex)) {
        continue;
      }

      children.push(
        new SceneFlexItem({
          minHeight: 150,
          minWidth: 370,
          $variables: getVariablesWithMetricConstant(metricName),
          body: getPanelForMetric(metricName),
        })
      );

      if (children.length > 10) {
        break;
      }
    }

    this.state.body.setState({ children });
  }

  public onSearchChange = (evt: React.SyntheticEvent<HTMLInputElement>) => {
    this.setState({ searchQuery: evt.currentTarget.value });
    this.buildLayout();
  };

  public static Component = ({ model }: SceneComponentProps<MetricSelectLayout>) => {
    const { showHeading, searchQuery } = model.useState();
    const styles = useStyles2(getStyles);

    console.log('showHadin', showHeading);
    return (
      <Flex direction="column">
        {showHeading && <Text variant="h4">Select a metric</Text>}
        <div className={styles.header}>
          <Input placeholder="Search metrics" value={searchQuery} onChange={model.onSearchChange} />
          <InlineSwitch showLabel={true} label="Show previews" />
        </div>
        <model.state.body.Component model={model.state.body} />
      </Flex>
    );
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

function getStyles(theme: GrafanaTheme2) {
  return {
    header: css({
      flexGrow: 1,
      display: 'flex',
      gap: theme.spacing(2),
      marginBottom: theme.spacing(1),
    }),
  };
}

{
  /* <Card
key={index}
href={sceneGraph.interpolate(model, `\${__url.path}\${__url.params}&metric=${option.value}`)}
>
<Card.Heading>{String(option.value)}</Card.Heading>
</Card> */
}
