import { Scene } from '../components/Scene';
import { SceneCanvasText } from '../components/SceneCanvasText';
import { SceneSubMenu } from '../components/SceneSubMenu';
import { SceneTimePicker } from '../components/SceneTimePicker';
import { SceneFlexLayout } from '../components/layout/SceneFlexLayout';
import { SceneTimeRange } from '../core/SceneTimeRange';
import { VariableValueSelectors } from '../variables/components/VariableValueSelectors';
import { SceneVariableSet } from '../variables/sets/SceneVariableSet';
import { CustomVariable } from '../variables/variants/CustomVariable';
import { QueryVariable } from '../variables/variants/QueryVariable';

export function getQueryVariableDependenciesDemo(): Scene {
  const scene = new Scene({
    title: 'Query variable - regex variable dependency',
    $variables: new SceneVariableSet({
      variables: [
        new CustomVariable({
          name: 'regex',
          query: 'prom,graf,nod',
          value: 'prom',
        }),
        new QueryVariable({
          name: 'job',
          query: { query: 'label_values(go_gc_duration_seconds, job)' },
          datasource: { uid: 'gdev-prometheus', type: 'prometheus' },
          regex: '/^${regex}*/',
        }),
      ],
    }),
    layout: new SceneFlexLayout({
      direction: 'row',
      children: [
        new SceneFlexLayout({
          children: [
            new SceneCanvasText({
              size: { width: '40%' },
              text: 'job: ${job}',
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
