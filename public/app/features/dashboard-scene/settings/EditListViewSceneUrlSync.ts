import { SceneObjectUrlSyncHandler, SceneObjectUrlValues } from '@grafana/scenes';

import { AnnotationsEditView, AnnotationsEditViewState } from './AnnotationsEditView';
import { DashboardLinksEditView, DashboardLinksEditViewState } from './DashboardLinksEditView';
import { VariablesEditView, VariablesEditViewState } from './VariablesEditView';

type EditListViewUrlSync = DashboardLinksEditView | VariablesEditView | AnnotationsEditView;
type EditListViewState = DashboardLinksEditViewState | VariablesEditViewState | AnnotationsEditViewState;
export class EditListViewSceneUrlSync implements SceneObjectUrlSyncHandler {
  constructor(private _scene: EditListViewUrlSync) {}

  getKeys(): string[] {
    return ['editIndex'];
  }

  getUrlState(): SceneObjectUrlValues {
    const state = this._scene.state;
    return {
      editIndex: state.editIndex !== undefined ? String(state.editIndex) : undefined,
    };
  }

  updateFromUrl(values: SceneObjectUrlValues): void {
    let update: Partial<EditListViewState> = {};
    if (typeof values.editIndex === 'string') {
      update = { editIndex: Number(values.editIndex) };
    } else {
      update = { editIndex: undefined };
    }

    if (Object.keys(update).length > 0) {
      this._scene.setState(update);
    }
  }
}
