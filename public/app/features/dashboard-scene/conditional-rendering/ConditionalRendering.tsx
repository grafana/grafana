import { t } from '@grafana/i18n';
import { SceneComponentProps, sceneGraph, SceneObject, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { ConditionalRenderingGroupKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { ConditionalRenderingChangedEvent } from '../edit-pane/shared';

import { ConditionalRenderingBase } from './ConditionalRenderingBase';
import { ConditionalRenderingGroup } from './ConditionalRenderingGroup';
import { ConditionEvaluationResult, ItemsWithConditionalRendering } from './types';
import { getItemType, translatedItemType } from './utils';

export interface ConditionalRenderingState extends SceneObjectState {
  rootGroup: ConditionalRenderingGroup;
  result: boolean;
  renderHidden: boolean;
}

export class ConditionalRendering extends SceneObjectBase<ConditionalRenderingState> {
  public static Component = ConditionalRenderingRenderer;

  public get info(): string {
    return t(
      'dashboard.conditional-rendering.root.info',
      'Set rules to control {{type}} visibility by matching any or all rules.',
      { type: translatedItemType(this.getItemType()) }
    );
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

  public recalculateResult(): ConditionEvaluationResult {
    const result = this.state.rootGroup.recalculateResult();
    const renderHidden = this.state.renderHidden;

    if (this.state.result !== result || this.state.renderHidden !== renderHidden) {
      this.setState({ result, renderHidden });
      this.parent?.publishEvent(new ConditionalRenderingChangedEvent(this), true);
    }

    return result;
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
    return new ConditionalRendering({
      rootGroup: ConditionalRenderingGroup.createEmpty(),
      result: true,
      renderHidden: false,
    });
  }
}

function ConditionalRenderingRenderer({ model }: SceneComponentProps<ConditionalRendering>) {
  const { rootGroup } = model.useState();

  return rootGroup.render(false);
}
