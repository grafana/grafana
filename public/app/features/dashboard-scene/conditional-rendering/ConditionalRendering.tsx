import { SceneComponentProps, sceneGraph, SceneObject, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { ConditionalRenderingGroupKind } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';
import { t } from 'app/core/internationalization';

import { ConditionalRenderingChangedEvent } from '../edit-pane/shared';

import { ConditionalRenderingBase } from './ConditionalRenderingBase';
import { ConditionalRenderingGroup } from './ConditionalRenderingGroup';
import { ItemsWithConditionalRendering } from './types';
import { getItemType } from './utils';

export interface ConditionalRenderingState extends SceneObjectState {
  rootGroup: ConditionalRenderingGroup;
}

export class ConditionalRendering extends SceneObjectBase<ConditionalRenderingState> {
  public static Component = ConditionalRenderingRenderer;

  public get info(): string {
    switch (this.getItemType()) {
      case 'auto-grid-item':
        return t(
          'dashboard.conditional-rendering.info.panel',
          'Set rules to control panel visibility by matching any or all rules.'
        );

      case 'row':
        return t(
          'dashboard.conditional-rendering.info.row',
          'Set rules to control row visibility by matching any or all rules.'
        );

      case 'tab':
        return t(
          'dashboard.conditional-rendering.info.tab',
          'Set rules to control tab visibility by matching any or all rules.'
        );

      default:
        return t(
          'dashboard.conditional-rendering.info.element',
          'Set rules to control element visibility by matching any or all rules.'
        );
    }
  }

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
    this.parent?.publishEvent(new ConditionalRenderingChangedEvent(this), true);
  }

  public deleteItem<T extends ConditionalRenderingBase>(item: T) {
    sceneGraph.getAncestor(item, ConditionalRenderingGroup).removeItem(item.state.key!);
  }

  public serialize(): ConditionalRenderingGroupKind {
    return this.state.rootGroup.serialize();
  }

  public getItem(): SceneObject {
    return this.parent!;
  }

  public getItemType(): ItemsWithConditionalRendering {
    return getItemType(this.getItem());
  }

  public static createEmpty(): ConditionalRendering {
    return new ConditionalRendering({ rootGroup: ConditionalRenderingGroup.createEmpty() });
  }
}

function ConditionalRenderingRenderer({ model }: SceneComponentProps<ConditionalRendering>) {
  const { rootGroup } = model.useState();

  return rootGroup.render(false);
}
