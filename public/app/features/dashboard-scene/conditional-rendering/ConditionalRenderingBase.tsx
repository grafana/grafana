import { ReactNode } from 'react';

import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { ControlledCollapse } from '@grafana/ui';

import { ConditionalRendering } from './ConditionalRendering';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ConditionalRenderingBaseState<V = any> extends SceneObjectState {
  value: V;
  isCollapsed?: boolean;
}

export abstract class ConditionalRenderingBase<S extends ConditionalRenderingBaseState> extends SceneObjectBase<S> {
  public static Component = ConditionalRenderingBaseRenderer;

  public abstract readonly title: string;

  public abstract evaluate(): boolean;

  public abstract render(): ReactNode;

  public getBehavior(): ConditionalRendering {
    return sceneGraph.getAncestor(this, ConditionalRendering);
  }

  public setStateAndNotify(state: Partial<S>) {
    this.setState(state);
    this.getBehavior().notifyChange();
  }

  public changeValue(value: S['value']) {
    // @ts-expect-error: For some reason this throws an error
    this.setStateAndNotify({ value });
  }

  public toggleCollapse() {
    // @ts-expect-error: For some reason this throws an error
    this.setState({ isCollapsed: !this.state.isCollapsed });
  }
}

function ConditionalRenderingBaseRenderer({
  model,
}: SceneComponentProps<ConditionalRenderingBase<ConditionalRenderingBaseState>>) {
  const { isCollapsed } = model.useState();

  return (
    <ControlledCollapse label={model.title} isOpen={!isCollapsed} onToggle={() => model.toggleCollapse()}>
      {model.render()}
    </ControlledCollapse>
  );
}
