import { locationService } from '@grafana/runtime';
import {
  NewSceneObjectAddedEvent,
  sceneGraph,
  SceneVariableSet,
  sceneUtils,
  type SceneObjectUrlValues,
} from '@grafana/scenes';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { type DashboardScene } from '../../scene/DashboardScene';
import { buildDashboardWithAccessInfoFromScene } from '../../serialization/buildDashboardWithAccessInfoFromScene';
import { transformSaveModelSchemaV2ToScene } from '../../serialization/transformSaveModelSchemaV2ToScene';
import { edit } from '../utils/edit';

// Minimal structural type for the bits of DashboardSceneUrlSync the rebuild drives, without
// importing it (avoids a circular import).
type DashboardUrlSync = {
  retainEditPanelAcrossRebuild: (panelId: string) => void;
  updateFromUrl: (values: SceneObjectUrlValues) => void;
};

export interface ApplyDashboardSpecProps {
  scene: DashboardScene;
  spec: DashboardV2Spec;
  description: string;
}

export function applyDashboardSpec({ scene, spec, description }: ApplyDashboardSpecProps): void {
  const dto = buildDashboardWithAccessInfoFromScene(scene, spec);
  const rebuilt = transformSaveModelSchemaV2ToScene(dto);

  // Keep sidebar alive - otherwise undo/redo stack would be wiped out
  const { isOverlayLoading: rebuiltLoading, ...newState } = sceneUtils.cloneSceneObjectState(rebuilt.state, {
    key: scene.state.key,
    sidebar: scene.state.sidebar,
  });
  const { isOverlayLoading: previousLoading, ...previousState } = scene.state;

  // `setState` merges, so an open panel editor would survive the swap still driving the
  // VizPanel and layout item of the tree we just discarded: edits made through it never reach
  // the new tree, and so are absent from a save or a read. Drop it and re-open through url
  // sync, the same path `?editPanel=` takes, which resolves the id against the current tree,
  // waits for a library panel to load, and leaves the pane closed when the applied spec no
  // longer has the panel.
  const editPanelKey = scene.state.editPanel?.getUrlKey();
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrow the base handler to the dashboard's own, which owns the hold below
  const urlSync = scene.urlSync as DashboardUrlSync | undefined;

  edit({
    source: scene,
    description,
    perform: () => {
      if (editPanelKey) {
        // Dropping the pane below writes `?editPanel=` out of the URL, and the re-open cannot
        // always put it back in the same tick: a library panel has to load first. Hold the param
        // so a reload during that window, or a load that never completes, still names the panel.
        urlSync?.retainEditPanelAcrossRebuild(editPanelKey);
      }

      scene.setState({ ...newState, editPanel: undefined, isDirty: true });
      // Dashboard state is replaced in place losing all edit-only properties.
      // Calling editModeChange rehydrates the panel's edit state (for example isDraggable state)
      scene.state.body.editModeChanged?.(true);

      scene.state.sidebar.refreshAfterRebuild();

      // The swapped-in children have never seen the URL, so url-only state is gone and a tabs
      // layout writes its default over `?dtab=`. Per child rather than for the scene itself: that
      // keeps the dashboard's own keys out of the pass, leaving the re-open below the only path
      // into panel edit.
      syncRebuiltChildrenFromUrl(scene);

      if (editPanelKey) {
        urlSync?.updateFromUrl({ editPanel: editPanelKey });
      }
    },
    undo: () => {
      scene.setState(previousState);
      scene.state.sidebar.refreshAfterRebuild();
      syncRebuiltChildrenFromUrl(scene);
    },
  });
}

/**
 * Re-attaches the swapped-in children to url sync, which restores url-only state such as the
 * selected tab. Variable values are not url-only: the spec carries them, so the URL is first
 * rewritten to the rebuilt values. Otherwise the sync reads the pre-swap `var-*` params back
 * and silently reverts every variable value the spec just set.
 */
function syncRebuiltChildrenFromUrl(scene: DashboardScene) {
  const search = locationService.getSearch();
  const variableUrlState: SceneObjectUrlValues = {};
  for (const set of sceneGraph.findAllObjects(scene, (obj) => obj instanceof SceneVariableSet)) {
    for (const [key, value] of Object.entries(sceneUtils.getUrlState(set))) {
      // Only keys the URL already holds: those are the ones the sync below would read back.
      if (search.has(key)) {
        variableUrlState[key] = value;
      }
    }
  }
  if (Object.keys(variableUrlState).length > 0) {
    locationService.partial(variableUrlState, true);
  }

  scene.forEachChild((child) => scene.publishEvent(new NewSceneObjectAddedEvent(child), true));
}
