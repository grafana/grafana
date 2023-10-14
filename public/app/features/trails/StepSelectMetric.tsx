import React from 'react';

import {
  SceneObjectState,
  SceneObjectBase,
  VariableDependencyConfig,
  VariableValueOption,
  sceneGraph,
  MultiValueVariable,
  SceneComponentProps,
  AdHocFiltersVariable,
  EmbeddedScene,
  EmbeddedSceneState,
  QueryVariable,
  SceneControlsSpacer,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  SceneVariableSet,
  VariableValueSelectors,
} from '@grafana/scenes';
import { VariableHide } from '@grafana/schema';
import { Input, Card } from '@grafana/ui';
import { Flex } from '@grafana/ui/src/unstable';

import { trailsDS } from './DataTrailsScene';

export interface TrailPhaseSelectMetricState extends SceneObjectState {}

export class TrailPhaseSelectMetric extends SceneObjectBase<TrailPhaseSelectMetricState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: ['metricName'],
  });

  public getMetricNames(): VariableValueOption[] {
    const variable = sceneGraph.lookupVariable('metricName', this);
    if (variable instanceof MultiValueVariable) {
      return variable.state.options;
    }

    return [];
  }

  static Component = ({ model }: SceneComponentProps<TrailPhaseSelectMetric>) => {
    model.useState();
    const options = model.getMetricNames();

    return (
      <Flex direction="column" gap={0}>
        <Flex direction="column" gap={2}>
          <Input placeholder="Search metrics" />
          <div></div>
        </Flex>
        {options.map((option, index) => (
          <Card
            key={index}
            href={sceneGraph.interpolate(
              model,
              `\${__url.path}\${__url.params:exclude:var-metricName}&metric=${option.value}`
            )}
          >
            <Card.Heading>{String(option.value)}</Card.Heading>
          </Card>
        ))}
      </Flex>
    );
  };
}

function getSceneDefaults(): Partial<EmbeddedSceneState> {
  return {
    controls: [
      new VariableValueSelectors({}),
      new SceneControlsSpacer(),
      new SceneTimePicker({}),
      new SceneRefreshPicker({}),
    ],
    $timeRange: new SceneTimeRange({}),
  };
}

export function buildSelectMetricScene() {
  return new EmbeddedScene({
    ...getSceneDefaults(),
    $variables: new SceneVariableSet({
      variables: [
        AdHocFiltersVariable.create({
          name: 'labelFilters',
          datasource: trailsDS,
          filters: [],
        }),
        new QueryVariable({
          name: 'metricName',
          datasource: trailsDS,
          hide: VariableHide.hideVariable,
          includeAll: true,
          defaultToAll: true,
          query: { query: 'label_values({$labelFilters},__name__)', refId: 'A' },
        }),
      ],
    }),
    body: new TrailPhaseSelectMetric({}),
  });
}
