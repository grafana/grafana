import {
  VizPanel,
  SceneCanvasText,
  SceneTimePicker,
  SceneFlexLayout,
  SceneTimeRange,
  VariableValueSelectors,
  SceneVariableSet,
  CustomVariable,
  DataSourceVariable,
  TestVariable,
  NestedScene,
  TextBoxVariable,
} from '@grafana/scenes';

import { DashboardScene } from '../dashboard/DashboardScene';

import { getQueryRunnerWithRandomWalkQuery } from './queries';

export function getVariablesDemo(): DashboardScene {
  return new DashboardScene({
    title: 'Variables',
    $variables: new SceneVariableSet({
      variables: [
        new TestVariable({
          name: 'server',
          query: 'A.*',
          value: 'server',
          text: '',
          delayMs: 1000,
          options: [],
        }),
        new TestVariable({
          name: 'pod',
          query: 'A.$server.*',
          value: 'pod',
          delayMs: 1000,
          isMulti: true,
          text: '',
          options: [],
        }),
        new TestVariable({
          name: 'handler',
          query: 'A.$server.$pod.*',
          value: 'handler',
          delayMs: 1000,
          //isMulti: true,
          text: '',
          options: [],
        }),
        new CustomVariable({
          name: 'custom',
          query: 'A : 10,B : 20',
        }),
        new DataSourceVariable({
          name: 'ds',
          pluginId: 'testdata',
        }),
        new TextBoxVariable({
          name: 'textbox',
          value: 'default value',
        }),
      ],
    }),
    body: new SceneFlexLayout({
      direction: 'row',
      children: [
        new SceneFlexLayout({
          direction: 'column',
          children: [
            new SceneFlexLayout({
              children: [
                new VizPanel({
                  pluginId: 'timeseries',
                  title: 'handler: $handler',
                  $data: getQueryRunnerWithRandomWalkQuery({
                    alias: 'handler: $handler',
                  }),
                }),
                new SceneCanvasText({
                  text: 'Text: ${textbox}',
                  fontSize: 20,
                  align: 'center',
                }),
                new SceneCanvasText({
                  placement: { width: '40%' },
                  text: 'server: ${server} pod:${pod}',
                  fontSize: 20,
                  align: 'center',
                }),
              ],
            }),
            new NestedScene({
              title: 'Collapsable inner scene',
              canCollapse: true,
              body: new SceneFlexLayout({
                direction: 'row',
                children: [
                  new VizPanel({
                    pluginId: 'timeseries',
                    title: 'handler: $handler',
                    $data: getQueryRunnerWithRandomWalkQuery({
                      alias: 'handler: $handler',
                    }),
                  }),
                ],
              }),
            }),
          ],
        }),
      ],
    }),
    $timeRange: new SceneTimeRange(),
    actions: [new SceneTimePicker({})],
    controls: [new VariableValueSelectors({})],
  });
}

export function getVariablesDemoWithAll(): DashboardScene {
  return new DashboardScene({
    title: 'Variables with All values',
    $variables: new SceneVariableSet({
      variables: [
        new TestVariable({
          name: 'server',
          query: 'A.*',
          value: 'AA',
          text: 'AA',
          includeAll: true,
          defaultToAll: true,
          delayMs: 1000,
          options: [],
        }),
        new TestVariable({
          name: 'pod',
          query: 'A.$server.*',
          value: [],
          delayMs: 1000,
          isMulti: true,
          includeAll: true,
          defaultToAll: true,
          text: '',
          options: [],
        }),
        new TestVariable({
          name: 'handler',
          query: 'A.$server.$pod.*',
          value: [],
          delayMs: 1000,
          includeAll: true,
          defaultToAll: false,
          isMulti: true,
          text: '',
          options: [],
        }),
      ],
    }),
    body: new SceneFlexLayout({
      direction: 'row',
      children: [
        new SceneFlexLayout({
          children: [
            new VizPanel({
              pluginId: 'timeseries',
              title: 'handler: $handler',
              $data: getQueryRunnerWithRandomWalkQuery({
                alias: 'handler: $handler',
              }),
            }),
            new SceneCanvasText({
              placement: { width: '40%' },
              text: 'server: ${server} pod:${pod}',
              fontSize: 20,
              align: 'center',
            }),
          ],
        }),
      ],
    }),
    $timeRange: new SceneTimeRange(),
    actions: [new SceneTimePicker({})],
    controls: [new VariableValueSelectors({})],
  });
}
