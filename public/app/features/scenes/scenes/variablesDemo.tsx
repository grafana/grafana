import { VizPanel } from '../components';
import { Scene, EmbeddedScene } from '../components/Scene';
import { SceneCanvasText } from '../components/SceneCanvasText';
import { SceneSubMenu } from '../components/SceneSubMenu';
import { SceneTimePicker } from '../components/SceneTimePicker';
import { SceneFlexLayout } from '../components/layout/SceneFlexLayout';
import { SceneTimeRange } from '../core/SceneTimeRange';
import { VariableValueSelectors } from '../variables/components/VariableValueSelectors';
import { SceneVariableSet } from '../variables/sets/SceneVariableSet';
import { CustomVariable } from '../variables/variants/CustomVariable';
import { DataSourceVariable } from '../variables/variants/DataSourceVariable';
import { TestVariable } from '../variables/variants/TestVariable';

import { getQueryRunnerWithRandomWalkQuery } from './queries';

export function getVariablesDemo(standalone: boolean): Scene {
  const state = {
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
          query: 'testdata',
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
    subMenu: new SceneSubMenu({
      children: [new VariableValueSelectors({})],
    }),
  };

  return standalone ? new Scene(state) : new EmbeddedScene(state);
}

export function getVariablesDemoWithAll(): Scene {
  const scene = new Scene({
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
    subMenu: new SceneSubMenu({
      children: [new VariableValueSelectors({})],
    }),
  });

  return scene;
}
