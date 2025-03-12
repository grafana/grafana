import { ReactNode } from 'react';

import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import {
  ConditionalRenderingGroupKind,
  ConditionalRenderingVariableKind,
  ConditionalRenderingDataKind,
  ConditionalRenderingTimeIntervalKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';

import { ConditionalRendering } from './ConditionalRendering';
import { ConditionalRenderingGroup } from './ConditionalRenderingGroup';
import { ConditionValues } from './shared';

export interface ConditionalRenderingBaseState<V = ConditionValues> extends SceneObjectState {
  value: V;
}

export abstract class ConditionalRenderingBase<
  S extends ConditionalRenderingBaseState<ConditionValues>,
> extends SceneObjectBase<S> {
  public static Component = ConditionalRenderingBaseRenderer;

  public abstract readonly title: string;

  public abstract serialize():
    | ConditionalRenderingGroupKind
    | ConditionalRenderingVariableKind
    | ConditionalRenderingDataKind
    | ConditionalRenderingTimeIntervalKind;

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
