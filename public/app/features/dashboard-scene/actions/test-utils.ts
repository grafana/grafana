import { of } from 'rxjs';
import { MockDataSourceApi } from 'test/mocks/datasource_srv';

import { LoadingState } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import {
  config,
  type DataSourceSrv,
  getPluginImportUtils,
  setDataSourceSrv,
  setPluginImportUtils,
  setRunRequest,
} from '@grafana/runtime';
import { setGetObservablePluginLinks } from '@grafana/runtime/internal';
import { type DeepPartial, type SceneDeactivationHandler, SceneVariableSet } from '@grafana/scenes';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { type DashboardScene } from '../scene/DashboardScene';
import { transformSceneToSaveModelSchemaV2 } from '../serialization/transformSceneToSaveModelSchemaV2';
import { activateFullSceneTree, getTestDashboardSceneFromSaveModel } from '../utils/test-utils';

function registerRuntimeStubs() {
  try {
    // Throws when nothing registered them yet, and registering them twice throws as well
    getPluginImportUtils();
  } catch {
    setPluginImportUtils({
      importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
      getPanelPluginFromCache: () => undefined,
    });
  }

  // Panel menus resolve plugin links on activation, which is unavailable outside a running Grafana
  setGetObservablePluginLinks(() => of([]));

  // Query runners and annotation layers resolve a datasource as soon as they activate
  const dataSource = new MockDataSourceApi('edit-action-test-datasource');
  // disabling type checks since this is a test util
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  setDataSourceSrv({
    get: () => Promise.resolve(dataSource),
    getInstanceSettings: () => ({ uid: 'edit-action-test-datasource', type: 'testdata', meta: {} }),
    getList: () => [],
    reload: () => {},
  } as unknown as DataSourceSrv);

  setRunRequest((_datasource, request) =>
    of({ state: LoadingState.Done, series: [], timeRange: request.range, request })
  );
}

export interface EditActionTestContext {
  dashboard: DashboardScene;
  /** The dashboard variable set, for actions that operate on variables */
  getVariableSet(): SceneVariableSet;
  /** The dashboard save model as it looked before any action was performed */
  initialSpec: DashboardV2Spec;
  /** Current dashboard save model */
  getSpec(): DashboardV2Spec;
  /** Asserts the current save model contains everything in `expected` */
  expectSpec(expected: DeepPartial<DashboardV2Spec>): void;
  /** Asserts the current save model is identical to the one captured during setup */
  expectRestoredToInitialSpec(): void;
  undo(): void;
  redo(): void;
  /** Undoes every action currently on the undo stack, newest first */
  undoAll(): void;
  getHistorySizes(): { undo: number; redo: number };
  /**
   * Deactivates the scene. Only needed when a single test builds a second dashboard, since
   * activating two dashboards at once conflicts over globals such as the dashboard macro.
   */
  cleanup(): void;
}

let releasePreviousScene: (() => void) | undefined;

/**
 * Harness for testing dashboard edit actions end to end: build a dashboard from a save model,
 * run one or more actions against it, assert on the resulting save model, then undo and assert
 * the dashboard rolled back.
 *
 * Actions are invoked directly by the test; the harness only owns the dashboard, the save model
 * assertions and the undo/redo entry points, so tests do not need to know which scene object
 * hosts the undo/redo history.
 */
export function setupEditActionTest(spec?: Partial<DashboardV2Spec>): EditActionTestContext {
  registerRuntimeStubs();
  releasePreviousScene?.();

  const previousNewLayouts = config.featureToggles.dashboardNewLayouts;
  config.featureToggles.dashboardNewLayouts = true;

  const dashboard = getTestDashboardSceneFromSaveModel(spec);
  dashboard.setState({ isEditing: true });

  let deactivate: SceneDeactivationHandler | undefined = activateFullSceneTree(dashboard);

  const getSpec = () => transformSceneToSaveModelSchemaV2(dashboard);
  const initialSpec = getSpec();

  const cleanup = () => {
    deactivate?.();
    deactivate = undefined;
    config.featureToggles.dashboardNewLayouts = previousNewLayouts;
  };

  releasePreviousScene = cleanup;

  return {
    dashboard,
    initialSpec,
    getSpec,

    getVariableSet() {
      const variables = dashboard.state.$variables;
      if (!(variables instanceof SceneVariableSet)) {
        throw new Error('Test dashboard was built without a variable set');
      }
      return variables;
    },

    expectSpec(expected) {
      expect(getSpec()).toMatchObject(expected);
    },

    expectRestoredToInitialSpec() {
      expect(getSpec()).toEqual(initialSpec);
    },

    undo() {
      dashboard.state.sidebar.undoAction();
    },

    redo() {
      dashboard.state.sidebar.redoAction();
    },

    undoAll() {
      while (dashboard.state.sidebar.state.undoStack.length > 0) {
        dashboard.state.sidebar.undoAction();
      }
    },

    getHistorySizes() {
      const { undoStack, redoStack } = dashboard.state.sidebar.state;
      return { undo: undoStack.length, redo: redoStack.length };
    },

    cleanup,
  };
}
