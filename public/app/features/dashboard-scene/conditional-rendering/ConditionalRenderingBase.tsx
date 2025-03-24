import { ReactNode } from 'react';

import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';

import { ConditionalRendering } from './ConditionalRendering';
import { ConditionalRenderingGroup } from './ConditionalRenderingGroup';
import { ConditionalRenderingKindTypes } from './serializers';
import { ConditionValues } from './shared';

export interface ConditionalRenderingBaseState<V = ConditionValues> extends SceneObjectState {
  value: V;
}

export abstract class ConditionalRenderingBase<
  S extends ConditionalRenderingBaseState<ConditionValues>,
> extends SceneObjectBase<S> {
  public static Component = ConditionalRenderingBaseRenderer;

  public constructor(state: S) {
    super(state);

    this.addActivationHandler(() => this._baseActivationHandler());
  }

  private _baseActivationHandler() {
    // Similarly to the ConditionalRendering activation handler,
    // this ensures that all children are activated when conditional rendering is activated
    // We need this in order to allow children to subscribe to variable changes etc.
    this.forEachChild((child) => {
      if (!child.isActive) {
        this._subs.add(child.activate());
      }
    });
  }

  public abstract readonly title: string;

  public abstract serialize(): ConditionalRenderingKindTypes;

  public abstract evaluate(): boolean;

  public abstract render(): ReactNode;

  public abstract onDelete(): void;

  public getConditionalLogicRoot(): ConditionalRendering {
    return sceneGraph.getAncestor(this, ConditionalRendering);
  }

  public getRootGroup(): ConditionalRenderingGroup {
    return this.getConditionalLogicRoot().state.rootGroup;
  }

  public setStateAndNotify(state: Partial<S>) {
    this.setState(state);
    this.getConditionalLogicRoot().notifyChange();
  }
}

function ConditionalRenderingBaseRenderer({
  model,
}: SceneComponentProps<ConditionalRenderingBase<ConditionalRenderingBaseState>>) {
  return model.render();
}
