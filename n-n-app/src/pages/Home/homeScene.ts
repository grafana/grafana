import {
  CustomVariable,
  EmbeddedScene,
  PanelBuilders,
  SceneControlsSpacer,
  SceneFlexItem,
  SceneFlexLayout,
  SceneQueryRunner,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  SceneVariableSet,
  VariableValueSelectors,
} from '@grafana/scenes';
import { DATASOURCE_REF } from '../../constants';
import { CustomSceneObject } from './CustomSceneObject';

export function homeScene(templatised = true, seriesToShow = '__server_names') {
  const timeRange = new SceneTimeRange({
    from: 'now-6h',
    to: 'now',
  });

  // Variable definition, using Grafana built-in TestData datasource
  const customVariable = new CustomVariable({
    name: 'seriesToShow',
    label: 'Series to show',
    value: '__server_names',
    query: 'Server Names : __server_names, House locations : __house_locations',
  });

  // Query runner definition, using Grafana built-in TestData datasource
  const queryRunner = new SceneQueryRunner({
    datasource: DATASOURCE_REF,
    queries: [
      {
        refId: 'A',
        datasource: DATASOURCE_REF,
        scenarioId: 'random_walk',
        seriesCount: 5,
        // Query is using variable value
        alias: templatised ? '${seriesToShow}' : seriesToShow,
        min: 30,
        max: 60,
      },
    ],
    maxDataPoints: 100,
  });

  // Custom object definition
  const customObject = new CustomSceneObject({
    counter: 5,
  });

  // Query runner activation handler that will update query runner state when custom object state changes
  queryRunner.addActivationHandler(() => {
    const sub = customObject.subscribeToState((newState) => {
      queryRunner.setState({
        queries: [
          {
            ...queryRunner.state.queries[0],
            seriesCount: newState.counter,
          },
        ],
      });
      queryRunner.runQueries();
    });

    return () => {
      sub.unsubscribe();
    };
  });

  return new EmbeddedScene({
    $timeRange: timeRange,
    $variables: new SceneVariableSet({ variables: templatised ? [customVariable] : [] }),
    $data: queryRunner,
    body: new SceneFlexLayout({
      children: [
        new SceneFlexItem({
          minHeight: 300,
          body: PanelBuilders.timeseries()
            // Title is using variable value
            .setTitle(templatised ? '${seriesToShow}' : seriesToShow)
            .build(),
        }),
      ],
    }),
    controls: [
      new VariableValueSelectors({}),
      new SceneControlsSpacer(),
      customObject,
      new SceneTimePicker({ isOnCanvas: true }),
      new SceneRefreshPicker({
        intervals: ['5s', '1m', '1h'],
        isOnCanvas: true,
      }),
    ],
  });
}
