import { Button } from '@grafana/ui';
import React from 'react';
import { SceneRadioToggle } from '../apps/SceneRadioToggle';
import { Scene, SceneCanvasText, SceneSubMenu, SceneTimePicker } from '../components';
import { SceneFlexLayout } from '../components/layout/SceneFlexLayout';
import { EmbeddedScene } from '../components/Scene';
import { SceneSubMenuSpacer } from '../components/SceneSubMenu';
import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneTimeRange } from '../core/SceneTimeRange';
import { SceneComponentProps, SceneLayoutChildState } from '../core/types';
import { SceneVariableSet } from '../variables/sets/SceneVariableSet';
import { QueryVariable } from '../variables/variants/query/QueryVariable';

export function getCacheTest(standalone: boolean): Scene {
  const variables = new SceneVariableSet({
    variables: [
      new QueryVariable({
        name: 'instance',
        datasource: { uid: 'gdev-prometheus' },
        query: { query: 'label_values(grafana_http_request_duration_seconds_sum, instance)' },
      }),
    ],
  });
  const getLayoutKids = (l: string) => {
    return [
      new SceneFlexLayout({
        direction: 'row',
        children: [
          new SceneCanvasText({ text: `${l}: With initial count state`, size: { width: 300 } }),
          new TestSceneObject({ cacheKey: 'test' }),
          new TestSceneObject({}),
        ],
      }),

      new SceneFlexLayout({
        direction: 'row',
        children: [
          new SceneCanvasText({ text: `${l}: Without  initial count state`, size: { width: 300 } }),
          new TestSceneObject({ cacheKey: 'test1', count: 5 }),
          new TestSceneObject({ count: 5 }),
        ],
      }),
    ];
  };

  const layout = new SceneFlexLayout({
    direction: 'column',
    children: getLayoutKids('Layout 1'),
  });

  const sceneToggle = new SceneRadioToggle({
    options: [
      { value: 'l1', label: 'Layout 1' },
      { value: 'l2', label: 'Layout 2' },
    ],
    value: 'l1',
    onChange: (value) => {
      if (value === 'l1') {
        layout.setState({
          children: getLayoutKids('Layout 1'),
        });
      } else {
        layout.setState({ children: getLayoutKids('Layout 2') });
      }
    },
  });

  const state = {
    title: `Object state cache test`,
    $variables: variables,
    $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }),
    subMenu: new SceneSubMenu({
      children: [new SceneSubMenuSpacer(), sceneToggle, new SceneTimePicker({ isOnCanvas: true })],
    }),
    layout,
  };
  return standalone ? new Scene(state) : new EmbeddedScene(state);
}

interface TestSceneObjectState extends SceneLayoutChildState {
  count: number;
}
class TestSceneObject extends SceneObjectBase<TestSceneObjectState> {
  static Component = ({ model }: SceneComponentProps<TestSceneObject>) => {
    const { count, cacheKey } = model.useState();
    return (
      <div
        style={{
          display: 'flex',
          width: '100%',
          flexDirection: 'column',
          border: '1px solid red',
          justifyContent: 'center',
          padding: '20px',
        }}
      >
        <h1>
          Count {cacheKey ? '(cached)' : '(not cached)'}: {count}
        </h1>
        <Button onClick={model.onClick}>Increment</Button>
      </div>
    );
  };

  constructor(state: Partial<TestSceneObjectState>) {
    super({
      count: 0,
      ...state,
    });
    this.onClick = this.onClick.bind(this);
  }

  public onClick() {
    this.setState({ count: this.state.count + 1 });
  }
}
