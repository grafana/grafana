import { Button, Link } from '@grafana/ui';
import React, { useContext } from 'react';
import { Scene, SceneCanvasText, SceneSubMenu, SceneTimePicker } from '../components';
import { SceneFlexLayout } from '../components/layout/SceneFlexLayout';
import { EmbeddedScene, SceneContext } from '../components/Scene';
import { SceneSubMenuSpacer } from '../components/SceneSubMenu';
import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneTimeRange } from '../core/SceneTimeRange';
import { SceneComponentProps, SceneLayoutChildState } from '../core/types';
import { VariableValueSelectors } from '../variables/components/VariableValueSelectors';
import { SceneVariableSet } from '../variables/sets/SceneVariableSet';
import { CustomVariable } from '../variables/variants/CustomVariable';
import { QueryVariable } from '../variables/variants/query/QueryVariable';

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
    children: [new VariableValueSelectors({}), new SceneSubMenuSpacer(), new SceneTimePicker({ isOnCanvas: true })],
  });

const getLayout = (link: SceneLink, source = true) =>
  new SceneFlexLayout({
    direction: 'column',
    children: [
      new SceneFlexLayout({
        size: { ySizing: 'content' },
        direction: 'column',
        children: [
          new SceneCanvasText({
            text: source
              ? 'Some states are cached and will be preserved when navigating to the destination scene. Modify the state and click link below to go to another scene'
              : '',
            align: 'center',
          }),
          link,
        ],
      }),
      new SceneFlexLayout({
        direction: source ? 'row' : 'column',
        size: { ySizing: 'content' },
        children: [
          new TestSceneObject({ size: { ySizing: 'content' }, cacheKey: 'test' }),
          new TestSceneObject({ size: { ySizing: 'content' } }),
        ],
      }),
      new SceneFlexLayout({
        direction: 'row',
        size: { ySizing: 'content' },
        children: [],
      }),
    ],
  });

export const getCacheSceneState = (link: SceneLink, source = true) => ({
  title: `Object state cache test`,
  $variables: getVariables(),
  $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }),
  subMenu: getSubMenu(),
  layout: getLayout(link, source),
});

export function getCacheTest(standalone: boolean): Scene {
  const state = getCacheSceneState(
    new SceneLink({
      url: '/scenes/Cache%20test%20destination',
      text: 'Click to go to destination scene',
      size: { ySizing: 'content' },
    })
  );
  const scene = standalone ? new Scene(state) : new EmbeddedScene(state);

  return scene;
}

export function getCacheDestinationTest(standalone: boolean): Scene {
  const state = getCacheSceneState(
    new SceneLink({
      url: '/scenes/Cache%20test',
      text: 'Click to go to source scene',
      size: { ySizing: 'content' },
    }),
    false
  );
  const scene = standalone ? new Scene(state) : new EmbeddedScene(state);

  return scene;
}

interface TestSceneObjectState extends SceneLayoutChildState {
  count: number;
}

export class TestSceneObject extends SceneObjectBase<TestSceneObjectState> {
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
          {cacheKey ? 'Cached' : 'Not cached'}: {count}
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

interface SceneLinkState extends SceneLayoutChildState {
  url: string;
  text: string;
}

class SceneLink extends SceneObjectBase<SceneLinkState> {
  static Component = ({ model }: SceneComponentProps<SceneLink>) => {
    const sceneContext = useContext(SceneContext);
    if (!sceneContext) {
      throw new Error('Scene context not found');
    }

    return (
      <Link
        style={{ color: 'cornflowerblue' }}
        href={model.state.url}
        onClick={() => {
          sceneContext.scene.deactivate();
        }}
      >
        {model.state.text}
      </Link>
    );
  };
}
