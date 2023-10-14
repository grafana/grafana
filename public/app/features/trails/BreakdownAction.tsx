import React from 'react';

import {
  SceneObjectState,
  SceneObject,
  SceneObjectBase,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  sceneGraph,
  SceneComponentProps,
} from '@grafana/scenes';
import { Button } from '@grafana/ui';

export interface BreakdownActionButtonState extends SceneObjectState {
  isEnabled: boolean;
  childIndex: number;
  getBreakdownScene: () => SceneObject;
}

/**
 * Just a proof of concept example of a behavior
 */
export class BreakdownActionButton extends SceneObjectBase<BreakdownActionButtonState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['breakdown'] });
  private _breakdownScene?: SceneObject;

  constructor(state: BreakdownActionButtonState) {
    super(state);

    this.addActivationHandler(() => {
      // Enable breakdown on activation if set by url sync
      if (this.state.isEnabled && !this._breakdownScene) {
        this.addBreakdownScene();
      }
    });
  }

  public getUrlState() {
    return { breakdown: this.state.isEnabled ? '1' : '0' };
  }

  public updateFromUrl(values: SceneObjectUrlValues) {
    if (values.breakdown && !this.state.isEnabled) {
      this.setState({ isEnabled: true });
    } else if (this.state.isEnabled) {
      this.setState({ isEnabled: false });
    }
  }

  public onToggle = () => {
    const { isEnabled } = this.state;
    const layout = sceneGraph.getLayout(this)!;

    if (isEnabled) {
      layout.setState({ children: layout.state.children.filter((c) => c !== this._breakdownScene) });
      this.setState({ isEnabled: false });
    } else {
      this.addBreakdownScene();
      this.setState({ isEnabled: true });
    }
  };

  private addBreakdownScene() {
    const { childIndex, getBreakdownScene } = this.state;
    const layout = sceneGraph.getLayout(this)!;

    this._breakdownScene = getBreakdownScene();

    const newChildren = [
      ...layout.state.children.slice(0, childIndex),
      this._breakdownScene,
      ...layout.state.children.slice(childIndex),
    ];

    layout.setState({ children: newChildren });
  }

  public static Component = ({ model }: SceneComponentProps<BreakdownActionButton>) => {
    const { isEnabled } = model.useState();
    return (
      <Button onClick={model.onToggle} variant={isEnabled ? 'primary' : 'secondary'} size="sm">
        Breakdown
      </Button>
    );
  };
}
