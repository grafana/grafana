import {
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  VizPanel,
  sceneUtils,
  SceneVariables,
  SceneGridRow,
  sceneGraph,
  SceneVariableSet,
  SceneVariable,
} from '@grafana/scenes';

interface ViewPanelSceneState extends SceneObjectState {
  panelRef: SceneObjectRef<VizPanel>;
  body?: VizPanel;
}

export class ViewPanelScene extends SceneObjectBase<ViewPanelSceneState> {
  public getUrlKey() {
    return this.state.panelRef.resolve().state.key;
  }

  public static Component = ({ model }: SceneComponentProps<ViewPanelScene>) => {
    const { panelRef } = model.useState();
    const panel = panelRef.resolve();
    console.log(panel);

    return <panel.Component model={panel} />;
  };
}
