import { isEqual } from 'lodash';

import { locationService } from '@grafana/runtime';
import {
  NewSceneObjectAddedEvent,
  sceneUtils,
  type SceneObjectUrlValue,
  type SceneObjectUrlValues,
} from '@grafana/scenes';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { type DashboardScene } from '../../scene/DashboardScene';
import { buildDashboardWithAccessInfoFromScene } from '../../serialization/buildDashboardWithAccessInfoFromScene';
import { transformSaveModelSchemaV2ToScene } from '../../serialization/transformSaveModelSchemaV2ToScene';
import { transformSceneToSaveModelSchemaV2 } from '../../serialization/transformSceneToSaveModelSchemaV2';
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
  // The URL state each spec produces on its own, before any URL is applied. Their difference is
  // what the apply changes; everything else is a view the URL keeps (tab, zoom, ad hoc edits).
  const nextSpecUrl = sceneUtils.getUrlState(rebuilt);
  const previousSpecUrl = sceneUtils.getUrlState(
    transformSaveModelSchemaV2ToScene(
      buildDashboardWithAccessInfoFromScene(scene, transformSceneToSaveModelSchemaV2(scene))
    )
  );

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
      syncRebuiltChildrenFromUrl(scene, previousSpecUrl, nextSpecUrl);

      if (editPanelKey) {
        urlSync?.updateFromUrl({ editPanel: editPanelKey });
      }
    },
    undo: () => {
      scene.setState(previousState);
      scene.state.sidebar.refreshAfterRebuild();
      syncRebuiltChildrenFromUrl(scene, nextSpecUrl, previousSpecUrl);
    },
  });
}

/**
 * Re-attaches the swapped-in children to url sync, which restores url-only state. A key whose
 * spec value the swap changed is written to the URL first, as the scene now holds it, so the
 * sync does not read the pre-swap value back. Keys the URL does not hold are left out, and so are
 * the dashboard's own keys (`editPanel`, `viewPanel`, ...): those are view state no spec sets.
 */
function syncRebuiltChildrenFromUrl(
  scene: DashboardScene,
  fromSpec: SceneObjectUrlValues,
  toSpec: SceneObjectUrlValues
) {
  const live = sceneUtils.getUrlState(scene);
  const search = locationService.getSearch();
  const ownKeys = new Set(scene.urlSync?.getKeys());
  const updates: SceneObjectUrlValues = {};
  for (const key of new Set([...Object.keys(fromSpec), ...Object.keys(toSpec)])) {
    if (
      !ownKeys.has(key) &&
      search.has(key) &&
      !isSameUrlValue(fromSpec[key], toSpec[key]) &&
      !isSameUrlValue(search.getAll(key), live[key])
    ) {
      updates[key] = live[key] ?? null;
    }
  }
  // `time` and `time.window` win over `from`/`to` and no spec carries them.
  if (('from' in updates || 'to' in updates) && search.has('time')) {
    updates.time = null;
    updates['time.window'] = null;
  }
  if (Object.keys(updates).length > 0) {
    locationService.partial(updates, true);
  }
  scene.forEachChild((child) => scene.publishEvent(new NewSceneObjectAddedEvent(child), true));
}

function isSameUrlValue(a: SceneObjectUrlValue, b: SceneObjectUrlValue) {
  const values = (value: SceneObjectUrlValue) => (value == null ? [] : Array.isArray(value) ? value : [value]);
  return isEqual(values(a), values(b));
}
