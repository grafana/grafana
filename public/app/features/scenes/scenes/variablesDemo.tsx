import { getDefaultTimeRange } from '@grafana/data';

import { Scene } from '../components/Scene';
import { SceneCanvasText } from '../components/SceneCanvasText';
import { SceneFlexLayout } from '../components/SceneFlexLayout';
import { SceneSubMenu } from '../components/SceneSubMenu';
import { SceneTimePicker } from '../components/SceneTimePicker';
import { SceneTimeRange } from '../core/SceneTimeRange';
import { VariableValueSelectors } from '../variables/components/VariableValueSelectors';
import { SceneVariableSet } from '../variables/sets/SceneVariableSet';
import { TestVariable } from '../variables/variants/TestVariable';

export function getVariablesDemo(): Scene {
  const scene = new Scene({
    title: 'Variables',
    layout: new SceneFlexLayout({
      direction: 'row',
      children: [
        new SceneCanvasText({
          text: 'Some text with a variable: ${server} - ${pod}',
          fontSize: 40,
          align: 'center',
        }),
      ],
    }),
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
          text: '',
          options: [],
        }),
        new TestVariable({
          name: 'handler',
          query: 'A.$server.$pod.*',
          value: 'handler',
          delayMs: 1000,
          text: '',
          options: [],
        }),
      ],
    }),
    $timeRange: new SceneTimeRange(getDefaultTimeRange()),
    actions: [new SceneTimePicker({})],
    subMenu: new SceneSubMenu({
      children: [new VariableValueSelectors({})],
    }),
  });

  return scene;
}
