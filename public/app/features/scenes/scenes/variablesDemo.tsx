import { VizPanel } from '../components';
import { Scene } from '../components/Scene';
import { SceneCanvasText } from '../components/SceneCanvasText';
import { SceneSubMenu } from '../components/SceneSubMenu';
import { SceneTimePicker } from '../components/SceneTimePicker';
import { SceneFlexLayout } from '../components/layout/SceneFlexLayout';
import { SceneTimeRange } from '../core/SceneTimeRange';
import { VariableValueSelectors } from '../variables/components/VariableValueSelectors';
import { SceneVariableSet } from '../variables/sets/SceneVariableSet';
import { ConstantVariable } from '../variables/variants/ConstantVariable';
import { CustomVariable } from '../variables/variants/CustomVariable';
import { DataSourceVariable } from '../variables/variants/DataSourceVariable';
import { TestVariable } from '../variables/variants/TestVariable';

import { getQueryRunnerWithRandomWalkQuery } from './queries';

export function getVariablesDemo(): Scene {
  const scene = new Scene({
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
        new ConstantVariable({
          name: 'constant',
          value: 'slow',
        }),
        new CustomVariable({
          name: 'Single Custom',
          query: 'A : 10,B : 20',
        }),
        new CustomVariable({
          name: 'Multi Custom',
          query: 'A : 10,B : 20',
          isMulti: true,
        }),
        new DataSourceVariable({
          name: 'DataSource',
          query: 'testdata',
        }),
        new DataSourceVariable({
          name: 'DataSource',
          query: 'prometheus',
        }),
        new DataSourceVariable({
          name: 'DataSource multi',
          query: 'prometheus',
          isMulti: true,
        }),
        new DataSourceVariable({
          name: 'Datasource w/ regex and using $constant',
          query: 'prometheus',
          regex: '.*$constant.*',
        }),
      ],
    }),
    layout: new SceneFlexLayout({
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
              size: { width: '40%' },
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
