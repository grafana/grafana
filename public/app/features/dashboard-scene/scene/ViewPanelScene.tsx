import React from 'react';

import {
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  VizPanel,
  sceneUtils,
} from '@grafana/scenes';

interface ViewPanelSceneState extends SceneObjectState {
  panelRef: SceneObjectRef<VizPanel>;
  body?: VizPanel;
}

export class ViewPanelScene extends SceneObjectBase<ViewPanelSceneState> {
  public constructor(state: ViewPanelSceneState) {
    super(state);

    this.addActivationHandler(this._activationHandler.bind(this));
  }

  public _activationHandler() {
    const panel = this.state.panelRef.resolve();
    const panelState = sceneUtils.cloneSceneObjectState(panel.state, { key: panel.state.key + '-view' });
    const body = new VizPanel(panelState);

    this.setState({ body });

    return () => {
      // Make sure we preserve data state
      if (body.state.$data) {
        panel.setState({ $data: body.state.$data.clone() });
      }
    };
  }

  public getUrlKey() {
    return this.state.panelRef.resolve().state.key;
  }

  public static Component = ({ model }: SceneComponentProps<ViewPanelScene>) => {
    const { body } = model.useState();

    if (!body) {
      return null;
    }

    return <body.Component model={body} />;
  };
}
