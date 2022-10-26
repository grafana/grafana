import { getDefaultTimeRange } from '@grafana/data';

import { Scene } from '../components/Scene';
import { SceneCanvasText } from '../components/SceneCanvasText';
import { SceneFlexLayout } from '../components/SceneFlexLayout';
import { SceneSubMenu } from '../components/SceneSubMenu';
import { SceneTimePicker } from '../components/SceneTimePicker';
import { SceneTimeRange } from '../core/SceneTimeRange';
import { SceneVariablesManager } from '../variables/SceneVariablesManager';
import { TestVariable } from '../variables/TestVariable';
import { VariableValueSelectors } from '../variables/components/VariableValueSelectors';

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
    $variables: new SceneVariablesManager({
      variables: [
        new TestVariable({
          name: 'server',
          query: 'A.*',
          value: 'server-initial',
          text: '',
          options: [],
        }),
        new TestVariable({
          name: 'pod',
          query: 'A.$server.*',
          value: 'pod-initial',
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
