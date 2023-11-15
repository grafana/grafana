import React from 'react';

import {
  SceneObjectState,
  SceneObjectBase,
  VariableDependencyConfig,
  sceneGraph,
  SceneComponentProps,
  SceneVariableSet,
  SceneVariable,
  QueryVariable,
  VariableValueOption,
} from '@grafana/scenes';
import { VariableHide } from '@grafana/schema';
import { Input, Card, Stack } from '@grafana/ui';

import { trailDS } from './shared';

export interface SelectMetricTrailViewState extends SceneObjectState {
  metricNames: VariableValueOption[];
}

export class SelectMetricTrailView extends SceneObjectBase<SelectMetricTrailViewState> {
  public constructor(state: Partial<SelectMetricTrailViewState>) {
    super({
      $variables: new SceneVariableSet({
        variables: [
          new QueryVariable({
            name: 'metricNames',
            datasource: trailDS,
            hide: VariableHide.hideVariable,
            includeAll: true,
            defaultToAll: true,
            skipUrlSync: true,
            query: { query: 'label_values({$filters},__name__)', refId: 'A' },
          }),
        ],
      }),
      metricNames: [],
      ...state,
    });
  }

  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: ['filters', 'metricNames'],
    onVariableUpdatesCompleted: this._onVariableChanged.bind(this),
  });

  private _onVariableChanged(changedVariables: Set<SceneVariable>, dependencyChanged: boolean): void {
    for (const variable of changedVariables) {
      if (variable.state.name === 'filters') {
        const variable = sceneGraph.lookupVariable('filters', this)!;
        // Temp hack
        (this.state.$variables as any)._handleVariableValueChanged(variable);
      }

      if (variable.state.name === 'metricNames' && variable instanceof QueryVariable) {
        this.setState({ metricNames: variable.state.options });
      }
    }
  }

  static Component = ({ model }: SceneComponentProps<SelectMetricTrailView>) => {
    const { metricNames } = model.useState();

    return (
      <Stack direction="column" gap={0}>
        <Stack direction="column" gap={2}>
          <Input placeholder="Search metrics" />
          <div></div>
        </Stack>
        {metricNames.map((option, index) => (
          <Card
            key={index}
            href={sceneGraph.interpolate(model, `\${__url.path}\${__url.params}&metric=${option.value}`)}
          >
            <Card.Heading>{String(option.value)}</Card.Heading>
          </Card>
        ))}
      </Stack>
    );
  };
}
