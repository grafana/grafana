import {
  SceneTimePicker,
  SceneTimeRange,
  VariableValueSelectors,
  SceneVariableSet,
  TestVariable,
  SceneRefreshPicker,
  PanelBuilders,
  SceneGridLayout,
  SceneControlsSpacer,
  SceneGridRow,
  SceneGridItem,
} from '@grafana/scenes';
import { VariableRefresh } from '@grafana/schema';
import { PanelRepeaterGridItem } from 'app/features/dashboard-scene/scene/PanelRepeaterGridItem';
import { RepeatedRowBehavior } from 'app/features/dashboard-scene/scene/RepeatedRowBehavior';

import { DashboardScene } from '../../dashboard-scene/scene/DashboardScene';

import { getQueryRunnerWithRandomWalkQuery } from './queries';

/**
 * Repeat panels by variable that changes with time refresh. This tries to setup a very specific scenario
 * where a variable that is slow (2s) and constantly changing it's result is used to repeat panels. This
 * can be used to verify that when the time range change the repeated panels with locally scoped variable value
 * still wait for the top level variable to finish loading and the repeat process to complete.
 */
export function getRepeatingPanelsDemo(): DashboardScene {
  return new DashboardScene({
    title: 'Variables - Repeating panels',
    $variables: new SceneVariableSet({
      variables: [
        new TestVariable({
          name: 'server',
          query: 'AB',
          value: 'server',
          text: '',
          delayMs: 2000,
          isMulti: true,
          includeAll: true,
          refresh: VariableRefresh.onTimeRangeChanged,
          optionsToReturn: [
            { label: 'A', value: 'A' },
            { label: 'B', value: 'B' },
          ],
          options: [],
          $behaviors: [changeVariable],
        }),
      ],
    }),
    body: new SceneGridLayout({
      isDraggable: true,
      isResizable: true,
      children: [
        new PanelRepeaterGridItem({
          variableName: 'server',
          x: 0,
          y: 0,
          width: 24,
          height: 8,
          itemHeight: 8,
          //@ts-expect-error
          source: PanelBuilders.timeseries()
            .setTitle('server = $server')
            .setData(getQueryRunnerWithRandomWalkQuery({ alias: 'server = $server' }))
            .build(),
        }),
      ],
    }),
    $timeRange: new SceneTimeRange(),
    actions: [],
    controls: [
      new VariableValueSelectors({}),
      new SceneControlsSpacer(),
      new SceneTimePicker({}),
      new SceneRefreshPicker({}),
    ],
  });
}

function changeVariable(variable: TestVariable) {
  const sub = variable.subscribeToState((state, old) => {
    if (!state.loading && old.loading) {
      setTimeout(() => {
        if (variable.state.query === 'AB') {
          variable.setState({
            query: 'ABC',
            optionsToReturn: [
              { label: 'A', value: 'A' },
              { label: 'B', value: 'B' },
              { label: 'C', value: 'C' },
            ],
          });
        } else {
          variable.setState({
            query: 'AB',
            optionsToReturn: [
              { label: 'A', value: 'A' },
              { label: 'B', value: 'B' },
            ],
          });
        }
      });
      return;
    }
  });

  return () => {
    sub.unsubscribe();
  };
}

export function getRepeatingRowsDemo(): DashboardScene {
  return new DashboardScene({
    title: 'Variables - Repeating rows',
    $variables: new SceneVariableSet({
      variables: [
        new TestVariable({
          name: 'server',
          query: 'AB',
          value: ['A', 'B', 'C'],
          text: ['A', 'B', 'C'],
          delayMs: 2000,
          isMulti: true,
          includeAll: true,
          refresh: VariableRefresh.onTimeRangeChanged,
          optionsToReturn: [
            { label: 'A', value: 'A' },
            { label: 'B', value: 'B' },
            { label: 'C', value: 'C' },
          ],
          options: [],
          $behaviors: [changeVariable],
        }),
      ],
    }),
    body: new SceneGridLayout({
      isDraggable: true,
      isResizable: true,
      children: [
        new SceneGridRow({
          title: 'Row $server',
          key: 'Row A',
          isCollapsed: false,
          y: 0,
          x: 0,
          $behaviors: [
            new RepeatedRowBehavior({
              variableName: 'server',
              sources: [
                new SceneGridItem({
                  x: 0,
                  y: 1,
                  width: 12,
                  height: 5,
                  isResizable: true,
                  isDraggable: true,
                  body: PanelBuilders.timeseries()
                    .setTitle('server = $server')
                    .setIsDraggable(true)
                    .setData(getQueryRunnerWithRandomWalkQuery({ alias: 'server = $server' }))
                    .build(),
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    $timeRange: new SceneTimeRange(),
    actions: [],
    controls: [
      new VariableValueSelectors({}),
      new SceneControlsSpacer(),
      new SceneTimePicker({}),
      new SceneRefreshPicker({}),
    ],
  });
}
