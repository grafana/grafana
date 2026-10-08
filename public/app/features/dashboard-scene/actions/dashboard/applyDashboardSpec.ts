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
  /** Where the spec edit came from, reported with undo/redo interactions. */
  scope: string;
}

export function applyDashboardSpec({ scene, spec, description, scope }: ApplyDashboardSpecProps): void {
  const dto = buildDashboardWithAccessInfoFromScene(scene, spec);
  const rebuilt = transformSaveModelSchemaV2ToScene(dto);
  // The URL state each spec produces on its own, before any URL is applied. Their difference is
  // what the apply changes; everything else is a view the URL keeps (tab, zoom, ad hoc edits).
  // The previous one takes a serialize and a rebuild of the whole dashboard, so it is only
  // computed once a swap finds the URL disagreeing with the incoming tree.
  const nextSpecUrl = sceneUtils.getUrlState(rebuilt);
  let previousSpecUrl: SceneObjectUrlValues | undefined;
  const getPreviousSpecUrl = () => (previousSpecUrl ??= specUrlState(scene));

  // Keep sidebar alive - otherwise undo/redo stack would be wiped out
  const { isOverlayLoading: rebuiltLoading, ...newState } = sceneUtils.cloneSceneObjectState(rebuilt.state, {
    key: scene.state.key,
    sidebar: scene.state.sidebar,
    // Template identity is not part of the dashboard spec or its access DTO.
    meta: { ...rebuilt.state.meta, isDashboardTemplate: scene.state.meta.isDashboardTemplate },
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
    meta: { actionId: 'dashboard.editSchema', scope },
    source: scene,
    description,
    perform: () => {
      if (editPanelKey) {
        // Dropping the pane below writes `?editPanel=` out of the URL, and the re-open cannot
        // always put it back in the same tick: a library panel has to load first. Hold the param
        // so a reload during that window, or a load that never completes, still names the panel.
        urlSync?.retainEditPanelAcrossRebuild(editPanelKey);
      }

      // Planned before the swap, while the outgoing tree is still the one a previous spec state
      // has to be read from. The incoming tree holds exactly `nextSpecUrl` until the re-sync.
      const urlUpdates = urlUpdatesForSwap(scene, {
        incoming: nextSpecUrl,
        outgoingKeys: Object.keys(sceneUtils.getUrlState(scene)),
        fromSpec: getPreviousSpecUrl,
        toSpec: () => nextSpecUrl,
      });
      scene.setState({
        ...newState,
        mode: scene.state.mode,
        editPanel: undefined,
        isDirty: true,
      });
      // Dashboard state is replaced in place losing all edit-only properties.
      // Calling editModeChange rehydrates the panel's edit state (for example isDraggable state)
      scene.applyEditPresentation();

      scene.state.sidebar.refreshAfterRebuild();

      // The swapped-in children have never seen the URL, so url-only state is gone and a tabs
      // layout writes its default over `?dtab=`. Per child rather than for the scene itself: that
      // keeps the dashboard's own keys out of the pass, leaving the re-open below the only path
      // into panel edit.
      syncRebuiltChildrenFromUrl(scene, urlUpdates);

      if (editPanelKey) {
        urlSync?.updateFromUrl({ editPanel: editPanelKey });
      }
    },
    undo: () => {
      const outgoingKeys = Object.keys(sceneUtils.getUrlState(scene));
      scene.setState({ ...previousState, mode: scene.state.mode });
      scene.applyEditPresentation();
      scene.state.sidebar.refreshAfterRebuild();
      // The restored tree is the one the apply replaced, so its spec state can be read from it now.
      const urlUpdates = urlUpdatesForSwap(scene, {
        incoming: sceneUtils.getUrlState(scene),
        outgoingKeys,
        fromSpec: () => nextSpecUrl,
        toSpec: getPreviousSpecUrl,
      });
      syncRebuiltChildrenFromUrl(scene, urlUpdates);
    },
  });
}

/** The URL state of the spec the scene serializes to, rebuilt on its own. */
function specUrlState(scene: DashboardScene): SceneObjectUrlValues {
  return sceneUtils.getUrlState(
    transformSaveModelSchemaV2ToScene(
      buildDashboardWithAccessInfoFromScene(scene, transformSceneToSaveModelSchemaV2(scene))
    )
  );
}

interface SwapUrlState {
  /** The URL state the incoming tree holds before the re-sync. */
  incoming: SceneObjectUrlValues;
  /** The URL keys the outgoing tree owns, so a key the swap removes is considered too. */
  outgoingKeys: string[];
  fromSpec: () => SceneObjectUrlValues;
  toSpec: () => SceneObjectUrlValues;
}

/**
 * The URL params to rewrite before the re-sync: each key whose spec value the swap changes, set to
 * the value the incoming tree holds, so the sync does not read the pre-swap value back. Only keys
 * where the URL disagrees with the incoming tree can need it, so when there are none the spec
 * states are never computed. Keys the URL does not hold are left out, and so are the dashboard's
 * own keys (`editPanel`, `viewPanel`, ...): those are view state no spec sets.
 */
function urlUpdatesForSwap(
  scene: DashboardScene,
  { incoming, outgoingKeys, fromSpec, toSpec }: SwapUrlState
): SceneObjectUrlValues {
  const search = locationService.getSearch();
  const ownKeys = new Set(scene.urlSync?.getKeys());
  const disagreeing = [...new Set([...Object.keys(incoming), ...outgoingKeys])].filter(
    (key) => !ownKeys.has(key) && search.has(key) && !isSameUrlValue(search.getAll(key), incoming[key])
  );
  if (disagreeing.length === 0) {
    return {};
  }

  const from = fromSpec();
  const to = toSpec();
  const updates: SceneObjectUrlValues = {};
  for (const key of disagreeing) {
    if (!isSameUrlValue(from[key], to[key])) {
      updates[key] = incoming[key] ?? null;
    }
  }
  // `time` and `time.window` win over `from`/`to` and no spec carries them.
  if (('from' in updates || 'to' in updates) && search.has('time')) {
    updates.time = null;
    updates['time.window'] = null;
  }
  return updates;
}

/**
 * Re-attaches the swapped-in children to url sync, which restores url-only state, after writing the
 * planned updates so the sync reads the incoming values for the keys the swap changed.
 */
function syncRebuiltChildrenFromUrl(scene: DashboardScene, updates: SceneObjectUrlValues) {
  if (Object.keys(updates).length > 0) {
    locationService.partial(updates, true);
  }
  scene.forEachChild((child) => scene.publishEvent(new NewSceneObjectAddedEvent(child), true));
}

function isSameUrlValue(a: SceneObjectUrlValue, b: SceneObjectUrlValue) {
  const values = (value: SceneObjectUrlValue) => (value == null ? [] : Array.isArray(value) ? value : [value]);
  return isEqual(values(a), values(b));
}
