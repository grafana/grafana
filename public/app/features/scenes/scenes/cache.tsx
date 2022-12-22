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
import { VariableValueSelectors } from '../variables/components/VariableValueSelectors';
import { SceneVariableSet } from '../variables/sets/SceneVariableSet';
import { CustomVariable } from '../variables/variants/CustomVariable';
import { QueryVariable } from '../variables/variants/query/QueryVariable';

export function getCacheTest(standalone: boolean): Scene {
  const getVariables = () =>
    new SceneVariableSet({
      variables: [
        new CustomVariable({
          name: 'metricCached',
          cacheKey: 'metric',
          query: 'job : job, instance : instance',
        }),
        new QueryVariable({
          name: 'selectedMetricVarCached',
          cacheKey: 'selectedMetricVarCached',
          query: { query: 'label_values(go_gc_duration_seconds,${metricCached})' },
          datasource: { uid: 'gdev-prometheus', type: 'prometheus' },
        }),
        new QueryVariable({
          name: 'instance (will requery on layout toggle)',
          query: { query: 'label_values(go_gc_duration_seconds, instance)' },
          datasource: { uid: 'gdev-prometheus', type: 'prometheus' },
        }),
      ],
    });

  const getSubMenu = () =>
    new SceneSubMenu({
      children: [
        new VariableValueSelectors({}),
        new SceneSubMenuSpacer(),
        sceneToggle,
        new SceneTimePicker({ isOnCanvas: true }),
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
      const vars = getVariables();
      if (value === 'l1') {
        scene.setState({ $variables: vars, subMenu: getSubMenu() });
        // Activating manually, as we are not creating a new scene in this demo
        vars.activate();
        layout.setState({
          children: getLayoutKids('Layout 1'),
        });
      } else {
        scene.setState({ $variables: vars, subMenu: getSubMenu() });
        // Activating manually, as we are not creating a new scene in this demo
        vars.activate();

        layout.setState({ children: getLayoutKids('Layout 2') });
      }
    },
  });

  const state = {
    title: `Object state cache test`,
    $variables: getVariables(),
    $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }),
    subMenu: getSubMenu(),
    layout: new SceneFlexLayout({ children: [] }),
  };
  const scene = standalone ? new Scene(state) : new EmbeddedScene(state);

  return scene;
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
