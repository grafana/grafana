import {
  CancelActivationHandler,
  SceneComponentProps,
  SceneObject,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  VizPanel,
} from '@grafana/scenes';

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
    return activateInActiveParents(panel);
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

function activateInActiveParents(so: SceneObject): CancelActivationHandler | undefined {
  let cancel: CancelActivationHandler | undefined;
  let parentCancel: CancelActivationHandler | undefined;

  if (so.isActive) {
    return cancel;
  }

  if (so.parent) {
    parentCancel = activateInActiveParents(so.parent);
  }

  cancel = so.activate();

  return () => {
    parentCancel?.();
    cancel();
  };
}
