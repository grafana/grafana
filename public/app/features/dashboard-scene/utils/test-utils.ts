import {
  DeepPartial,
  EmbeddedScene,
  SceneDeactivationHandler,
  SceneGridItem,
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

import { LibraryVizPanel } from '../scene/LibraryVizPanel';
import { VizPanelLinks, VizPanelLinksMenu } from '../scene/PanelLinks';
import { PanelRepeaterGridItem, RepeatDirection } from '../scene/PanelRepeaterGridItem';
import { RowRepeaterBehavior } from '../scene/RowRepeaterBehavior';

export function setupLoadDashboardMock(rsp: DeepPartial<DashboardDTO>, spy?: jest.Mock) {
  const loadDashboardMock = (spy || jest.fn()).mockResolvedValue(rsp);
  setDashboardLoaderSrv({
    loadDashboard: loadDashboardMock,
    // disabling type checks since this is a test util
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  } as unknown as DashboardLoaderSrv);
  return loadDashboardMock;
}

export function mockResizeObserver() {
  window.ResizeObserver = class ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      setTimeout(() => {
        callback(
          [
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
              // disabling type checks since this is a test util
              // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
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
}

export function buildPanelRepeaterScene(options: SceneOptions, source?: VizPanel | LibraryVizPanel) {
  const defaults = { usePanelRepeater: true, ...options };

  const repeater = new PanelRepeaterGridItem({
    variableName: 'server',
    repeatedPanels: [],
    repeatDirection: options.repeatDirection,
    maxPerRow: options.maxPerRow,
    itemHeight: options.itemHeight,
    source:
      source ??
      new VizPanel({
        title: 'Panel $server',
        pluginId: 'timeseries',
      }),
    x: options.x || 0,
    y: options.y || 0,
  });

  const gridItem = new SceneGridItem({
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

  const rowChildren = defaults.usePanelRepeater ? repeater : gridItem;

  const row = new SceneGridRow({
    $behaviors: defaults.useRowRepeater
      ? [
          new RowRepeaterBehavior({
            variableName: 'handler',
            sources: [rowChildren],
          }),
        ]
      : [],
    children: defaults.useRowRepeater ? [] : [rowChildren],
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
  });

  const scene = new EmbeddedScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    $variables: new SceneVariableSet({
      variables: [panelRepeatVariable, rowRepeatVariable],
    }),
    body: new SceneGridLayout({
      children: [row],
    }),
  });

  return { scene, repeater, row, variable: panelRepeatVariable };
}
