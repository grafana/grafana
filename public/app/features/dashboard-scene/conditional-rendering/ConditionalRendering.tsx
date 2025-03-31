import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { ConditionalRenderingGroupKind } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';

import { ConditionalRenderingBase } from './ConditionalRenderingBase';
import { ConditionalRenderingGroup } from './ConditionalRenderingGroup';

export interface ConditionalRenderingState extends SceneObjectState {
  rootGroup: ConditionalRenderingGroup;
}

export class ConditionalRendering extends SceneObjectBase<ConditionalRenderingState> {
  public static Component = ConditionalRenderingRenderer;

  public constructor(state: ConditionalRenderingState) {
    super(state);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    // This ensures that all children are activated when conditional rendering is activated
    // We need this to allow children to subscribe to variable changes etc.
    this.forEachChild((child) => {
      if (!child.isActive) {
        this._subs.add(child.activate());
      }
    });
  }

  public evaluate(): boolean {
    return this.state.rootGroup.evaluate();
  }

  public notifyChange() {
    this.parent?.forceRender();
  }

  public deleteItem<T extends ConditionalRenderingBase>(item: T) {
    sceneGraph.getAncestor(item, ConditionalRenderingGroup).removeItem(item.state.key!);
  }

  public serialize(): ConditionalRenderingGroupKind {
    return this.state.rootGroup.serialize();
  }

  public static createEmpty(): ConditionalRendering {
    return new ConditionalRendering({ rootGroup: ConditionalRenderingGroup.createEmpty() });
  }
}

function ConditionalRenderingRenderer({ model }: SceneComponentProps<ConditionalRendering>) {
  const { rootGroup } = model.useState();

  return rootGroup.render(false);
}
