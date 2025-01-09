import { VariableRefresh } from '@grafana/data';
import {
  DeepPartial,
  EmbeddedScene,
  SceneDeactivationHandler,
  SceneGridLayout,
  SceneGridRow,
  SceneObject,
  SceneTimeRange,
  SceneVariableSet,
  TestVariable,
  VizPanel,
} from '@grafana/scenes';
import { DashboardLoaderSrv, setDashboardLoaderSrv } from 'app/features/dashboard/services/DashboardLoaderSrv';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from 'app/features/variables/constants';
import { DashboardDTO } from 'app/types';

import { VizPanelLinks, VizPanelLinksMenu } from '../scene/PanelLinks';
import { RowRepeaterBehavior } from '../scene/RowRepeaterBehavior';
import { DashboardGridItem, RepeatDirection } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

export function setupLoadDashboardMock(rsp: DeepPartial<DashboardDTO>, spy?: jest.Mock) {
  const loadDashboardMock = (spy || jest.fn()).mockResolvedValue(rsp);
  const loadSnapshotMock = (spy || jest.fn()).mockResolvedValue(rsp);
  // disabling type checks since this is a test util
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  setDashboardLoaderSrv({
    loadDashboard: loadDashboardMock,
    loadSnapshot: loadSnapshotMock,
  } as unknown as DashboardLoaderSrv);
  return loadDashboardMock;
}

export function mockResizeObserver() {
  window.ResizeObserver = class ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      setTimeout(() => {
        callback(
          [
            // disabling type checks since this is a test util
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            {
              contentRect: {
                x: 1,
                y: 2,
                width: 500,
                height: 500,
                top: 100,
                bottom: 0,
                left: 100,
                right: 0,
              },
            } as ResizeObserverEntry,
          ],
          this
        );
      });
    }
    observe() {}
    disconnect() {}
    unobserve() {}
  };
}

/**
 * Useful from tests to simulate mounting a full scene. Children are activated before parents to simulate the real order
 * of React mount order and useEffect ordering.
 *
 */
export function activateFullSceneTree(scene: SceneObject): SceneDeactivationHandler {
  const deactivationHandlers: SceneDeactivationHandler[] = [];

  // Important that variables are activated before other children
  if (scene.state.$variables) {
    deactivationHandlers.push(activateFullSceneTree(scene.state.$variables));
  }

  scene.forEachChild((child) => {
    // For query runners which by default use the container width for maxDataPoints calculation we are setting a width.
    // In real life this is done by the React component when VizPanel is rendered.
    if ('setContainerWidth' in child) {
      // @ts-expect-error
      child.setContainerWidth(500);
    }
    deactivationHandlers.push(activateFullSceneTree(child));
  });

  deactivationHandlers.push(scene.activate());

  return () => {
    for (const handler of deactivationHandlers) {
      handler();
    }
  };
}

interface SceneOptions {
  variableQueryTime: number;
  maxPerRow?: number;
  itemHeight?: number;
  repeatDirection?: RepeatDirection;
  x?: number;
  y?: number;
  numberOfOptions?: number;
  usePanelRepeater?: boolean;
  useRowRepeater?: boolean;
  throwError?: string;
  variableRefresh?: VariableRefresh;
}

export function buildPanelRepeaterScene(options: SceneOptions, source?: VizPanel) {
  const defaults = { usePanelRepeater: true, ...options };

  const withRepeat = new DashboardGridItem({
    variableName: 'server',
    repeatedPanels: [],
    repeatDirection: options.repeatDirection,
    maxPerRow: options.maxPerRow,
    itemHeight: options.itemHeight,
    body:
      source ??
      new VizPanel({
        title: 'Panel $server',
        pluginId: 'timeseries',
      }),
    x: options.x || 0,
    y: options.y || 0,
  });

  const withoutRepeat = new DashboardGridItem({
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    body: new VizPanel({
      title: 'Panel $server',
      pluginId: 'timeseries',
      titleItems: [new VizPanelLinks({ menu: new VizPanelLinksMenu({}) })],
    }),
  });

  const row = new SceneGridRow({
    $behaviors: defaults.useRowRepeater ? [new RowRepeaterBehavior({ variableName: 'handler' })] : [],
    children: [defaults.usePanelRepeater ? withRepeat : withoutRepeat],
  });

  const panelRepeatVariable = new TestVariable({
    name: 'server',
    query: 'A.*',
    value: ALL_VARIABLE_VALUE,
    text: ALL_VARIABLE_TEXT,
    isMulti: true,
    includeAll: true,
    delayMs: options.variableQueryTime,
    optionsToReturn: [
      { label: 'A', value: '1' },
      { label: 'B', value: '2' },
      { label: 'C', value: '3' },
      { label: 'D', value: '4' },
      { label: 'E', value: '5' },
    ].slice(0, options.numberOfOptions),
    throwError: defaults.throwError,
    refresh: options.variableRefresh,
  });

  const rowRepeatVariable = new TestVariable({
    name: 'handler',
    query: 'A.*',
    value: ALL_VARIABLE_VALUE,
    text: ALL_VARIABLE_TEXT,
    isMulti: true,
    includeAll: true,
    delayMs: options.variableQueryTime,
    optionsToReturn: [
      { label: 'AA', value: '11' },
      { label: 'BB', value: '22' },
      { label: 'CC', value: '33' },
      { label: 'DD', value: '44' },
      { label: 'EE', value: '55' },
    ].slice(0, options.numberOfOptions),
    throwError: defaults.throwError,
  });

  const scene = new EmbeddedScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    $variables: new SceneVariableSet({
      variables: [panelRepeatVariable, rowRepeatVariable],
    }),
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: [row],
      }),
    }),
  });

  return { scene, repeater: withRepeat, row, variable: panelRepeatVariable };
}
