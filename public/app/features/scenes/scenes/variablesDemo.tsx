import { getDefaultTimeRange } from '@grafana/data';

import { Scene } from '../components/Scene';
import { SceneCanvasText } from '../components/SceneCanvasText';
import { SceneFlexLayout } from '../components/SceneFlexLayout';
import { SceneSubMenu } from '../components/SceneSubMenu';
import { SceneTimePicker } from '../components/SceneTimePicker';
import { SceneTimeRange } from '../core/SceneTimeRange';
import { QueryVariable } from '../variables/QueryVariable';
import { SceneVariableManager } from '../variables/SceneVariableSet';
import { VariableValueSelectors } from '../variables/components/VariableValueSelectors';

export function getVariablesDemo(): Scene {
  const scene = new Scene({
    title: 'Variables',
    layout: new SceneFlexLayout({
      direction: 'row',
      children: [
        new SceneCanvasText({
          text: 'Some text',
          fontSize: 40,
          align: 'center',
        }),
      ],
    }),
    $variables: new SceneVariableManager({
      variables: [
        new QueryVariable({
          name: 'server',
          query: 'A.*',
          value: '',
          text: '',
          options: [],
        }),
        new QueryVariable({
          name: 'pod',
          query: 'A.$server.*',
          value: '',
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
