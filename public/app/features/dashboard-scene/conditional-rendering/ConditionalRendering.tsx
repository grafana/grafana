import { SceneComponentProps, sceneGraph, SceneObject, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { ConditionalRenderingGroupKind } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';
import { t } from 'app/core/internationalization';

import { AutoGridItem } from '../scene/layout-responsive-grid/ResponsiveGridItem';
import { RowItem } from '../scene/layout-rows/RowItem';
import { TabItem } from '../scene/layout-tabs/TabItem';

import { ConditionalRenderingBase } from './ConditionalRenderingBase';
import { ConditionalRenderingGroup } from './ConditionalRenderingGroup';
import { ItemsWithConditionalRendering } from './types';

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
          'Show or hide the panel based on certain conditions by matching all or any rules.'
        );

      case 'row':
        return t(
          'dashboard.conditional-rendering.info.row',
          'Show or hide the row based on certain conditions by matching all or any rules.'
        );

      case 'tab':
        return t(
          'dashboard.conditional-rendering.info.tab',
          'Show or hide the panel based on certain conditions by matching all or any rules.'
        );

      default:
        return t(
          'dashboard.conditional-rendering.info.element',
          'Show or hide the element based on certain conditions by matching all or any rules.'
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
    const item = this.getItem();

    if (item instanceof AutoGridItem) {
      return 'auto-grid-item';
    } else if (item instanceof RowItem) {
      return 'row';
    } else if (item instanceof TabItem) {
      return 'tab';
    }

    return 'unknown';
  }

  public static createEmpty(): ConditionalRendering {
    return new ConditionalRendering({ rootGroup: ConditionalRenderingGroup.createEmpty() });
  }
}

function ConditionalRenderingRenderer({ model }: SceneComponentProps<ConditionalRendering>) {
  const { rootGroup } = model.useState();

  return rootGroup.render(false);
}
