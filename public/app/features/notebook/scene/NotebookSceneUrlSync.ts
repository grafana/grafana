import { locationService } from '@grafana/runtime';
import { type SceneObjectUrlSyncHandler, type SceneObjectUrlValues } from '@grafana/scenes';

import { canEditNotebooks } from '../permissions';
import { NOTEBOOK_EDIT_PARAM, NOTEBOOK_EDIT_PARAM_ON } from '../urls';

import { type NotebookScene } from './NotebookScene';

/**
 * Keeps the edit param and the scene's edit mode in step, so the url is a projection of the scene
 * rather than a second place the mode is stored. `UrlSyncManager` drives both directions: it writes
 * the url when the state changes, and calls `updateFromUrl` when the url changes under us — a pasted
 * link, the list page's Edit action, a reload, or browser back/forward.
 */
export class NotebookSceneUrlSync implements SceneObjectUrlSyncHandler {
  public constructor(private _scene: NotebookScene) {}

  public getKeys(): string[] {
    return [NOTEBOOK_EDIT_PARAM];
  }

  public getUrlState(): SceneObjectUrlValues {
    // undefined rather than 'false': locationService.partial deletes a key whose value is null or
    // undefined, so view mode leaves no param behind instead of an explicit ?edit=false.
    return { [NOTEBOOK_EDIT_PARAM]: this._scene.state.isEditing ? NOTEBOOK_EDIT_PARAM_ON : undefined };
  }

  public updateFromUrl(values: SceneObjectUrlValues): void {
    // Only reached for a key whose url value disagrees with getUrlState(), so the current mode needs
    // no checking. An absent param arrives as null, and anything that is not exactly 'true' means
    // view mode, so ?edit=false says what it looks like.
    if (values[NOTEBOOK_EDIT_PARAM] !== NOTEBOOK_EDIT_PARAM_ON) {
      this._scene.onExitEditMode();
      return;
    }

    // Asked here as well as inside onEnterEditMode. The two questions differ: this one is whether to
    // honour the param at all, and refusing has to clean the param up — which the scene cannot do
    // from a call it ignored.
    if (!canEditNotebooks()) {
      // The sync manager only writes the url in response to a state change, and a refusal produces
      // none, so the param would otherwise sit there claiming a mode the notebook is not in.
      locationService.partial({ [NOTEBOOK_EDIT_PARAM]: null }, true);
      return;
    }

    this._scene.onEnterEditMode();
  }
}
