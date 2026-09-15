import { NewSceneObjectAddedEvent, sceneUtils, type SceneObjectUrlValues } from '@grafana/scenes';
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

/**
 * If currently opened sidebar element is edit as code we close it and show dashboard settings.
 * This will ensure no stale content is shown if undo is clicked or the mutation API (applySpec)
 * changed the dashboard in meantime.
 */
function closeCodePane(scene: DashboardScene) {
  const { sidebar } = scene.state;
  if (sidebar.state?.openPane?.getId() === 'code') {
    sidebar.closePane();
  }
}

export function applyDashboardSpec({ scene, spec, description }: ApplyDashboardSpecProps): void {
  const dto = buildDashboardWithAccessInfoFromScene(scene, spec);
  const rebuilt = transformSaveModelSchemaV2ToScene(dto);

  // Keep sidebar alive - otherwise undo/redo stack would be wiped out
  const newState = sceneUtils.cloneSceneObjectState(rebuilt.state, {
    key: scene.state.key,
    sidebar: scene.state.sidebar,
  });
  const previousState = { ...scene.state };

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

      // Sidebar keeps selected element memoized. In case assistant calls applySpec while an element
      // is selected it may lead to interacting with the old copy of the element.
      closeCodePane(scene);

      // The swapped-in children have never seen the URL, so url-only state is gone and a tabs
      // layout writes its default over `?dtab=`. Per child rather than for the scene itself: that
      // keeps the dashboard's own keys out of the pass, leaving the re-open below the only path
      // into panel edit.
      scene.forEachChild((child) => scene.publishEvent(new NewSceneObjectAddedEvent(child), true));

      if (editPanelKey) {
        urlSync?.updateFromUrl({ editPanel: editPanelKey });
      }
    },
    undo: () => {
      scene.setState(previousState);
      closeCodePane(scene);
      scene.forEachChild((child) => scene.publishEvent(new NewSceneObjectAddedEvent(child), true));
    },
  });
}
