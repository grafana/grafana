import { SceneComponentProps, SceneObjectBase, SceneObjectRef, SceneObjectState, VizPanel } from '@grafana/scenes';

import { activateSceneObjectAndParentTree } from '../utils/utils';

interface ViewPanelSceneState extends SceneObjectState {
  panelRef: SceneObjectRef<VizPanel>;
}

export class ViewPanelScene extends SceneObjectBase<ViewPanelSceneState> {
  public constructor(state: ViewPanelSceneState) {
    super(state);

    this.addActivationHandler(this._activationHandler.bind(this));
  }

  public _activationHandler() {
    const panel = this.state.panelRef.resolve();
    return activateSceneObjectAndParentTree(panel);
  }

  public getUrlKey() {
    return this.state.panelRef.resolve().state.key;
  }

  public static Component = ({ model }: SceneComponentProps<ViewPanelScene>) => {
    const { panelRef } = model.useState();
    const panel = panelRef.resolve();

    return <panel.Component model={panel} />;
  };
}
