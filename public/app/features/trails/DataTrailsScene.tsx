import React from 'react';

import { PageLayoutType } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import {
  AdHocFilterSet,
  AdHocFiltersVariable,
  EmbeddedScene,
  MultiValueVariable,
  QueryVariable,
  SceneComponentProps,
  SceneControlsSpacer,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneVariableSet,
  VariableDependencyConfig,
  VariableValueOption,
  VariableValueSelectors,
} from '@grafana/scenes';
import { VariableHide } from '@grafana/schema';
import { Card, Input, Text } from '@grafana/ui';
import { Flex } from '@grafana/ui/src/unstable';
import { Page } from 'app/core/components/Page/Page';

export interface DataTrailState extends SceneObjectState {
  scene: EmbeddedScene;
}

export class DataTrail extends SceneObjectBase<DataTrailState> {
  static Component = ({ model }: SceneComponentProps<DataTrail>) => {
    const { scene } = model.useState();

    return <scene.Component model={scene} />;
  };
}

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
        <Flex direction="column" gap={0}>
          <Input placeholder="Search metrics" />
          <div></div>
        </Flex>
        {options.map((option, index) => (
          <Card
            key={index}
            onClick={() => {
              console.log('click');
            }}
          >
            <Card.Heading>{String(option.value)}</Card.Heading>
          </Card>
        ))}
      </Flex>
    );
  };
}

export interface DataTrailsAppState extends SceneObjectState {
  trail?: DataTrail;
}

export class DataTrailsApp extends SceneObjectBase<DataTrailsAppState> {
  static Component = ({ model }: SceneComponentProps<DataTrailsApp>) => {
    const { trail } = model.useState();
    return (
      <Page navId="explore" pageNav={{ text: 'Data trails' }}>
        {trail && <trail.Component model={trail} />}
      </Page>
    );
  };
}

export const trailsDS = { uid: 'gdev-prometheus', type: 'prometheus' };

export const dataTrailsApp = new DataTrailsApp({
  trail: new DataTrail({
    scene: new EmbeddedScene({
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
            query: { query: 'label_values({$labelFilters},__name__)', refId: 'A' },
          }),
        ],
      }),
      controls: [
        new VariableValueSelectors({}),
        new SceneControlsSpacer(),
        new SceneTimePicker({}),
        new SceneRefreshPicker({}),
      ],
      body: new TrailPhaseSelectMetric({}),
    }),
  }),
});
