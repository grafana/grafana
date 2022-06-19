import { SceneObjectBase } from './SceneObjectBase';
import { SceneEditorState, SceneEditor, SceneObject } from './types';

export class SceneEditManager extends SceneObjectBase<SceneEditorState> implements SceneEditor {
  mouseEnter(model: SceneObject) {
    this.setState({ hoverObject: { ref: model } });
  }

  mouseLeave(model: SceneObject) {
    if (model.parent) {
      this.setState({ hoverObject: { ref: model.parent } });
    } else {
      this.setState({ hoverObject: undefined });
    }
  }

  select(model: SceneObject) {
    this.setState({ selectedObject: { ref: model } });
  }
}
