import React from 'react';

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
  public constructor(state: ViewPanelSceneState) {
    super(state);

    this.addActivationHandler(this._activationHandler.bind(this));
  }

  public _activationHandler() {
    const panel = this.state.panelRef.resolve();
    const panelState = sceneUtils.cloneSceneObjectState(panel.state, {
      key: panel.state.key + '-view',
      $variables: this.getScopedVariables(panel),
    });

    const body = new VizPanel(panelState);

    this.setState({ body });

    return () => {
      // Make sure we preserve data state
      if (body.state.$data) {
        panel.setState({ $data: body.state.$data.clone() });
      }
    };
  }

  // In case the panel is inside a repeated row
  private getScopedVariables(panel: VizPanel): SceneVariables | undefined {
    const row = tryGetParentRow(panel);
    const variables: SceneVariable[] = [];

    // Because we are rendering the panel outside it's potential row context we need to copy the row (scoped) varables
    if (row && row.state.$variables) {
      for (const variable of row.state.$variables.state.variables) {
        variables.push(variable.clone());
      }
    }

    // If we have local scoped panel variables we need to add the row variables to it
    if (panel.state.$variables) {
      for (const variable of panel.state.$variables.state.variables) {
        variables.push(variable.clone());
      }
    }

    if (variables.length > 0) {
      return new SceneVariableSet({ variables });
    }

    return undefined;
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

function tryGetParentRow(panel: VizPanel): SceneGridRow | undefined {
  try {
    return sceneGraph.getAncestor(panel, SceneGridRow);
  } catch {
    return undefined;
  }
}
