import { ReactElement } from 'react';

import { Trans, t } from '@grafana/i18n';
import { SceneComponentProps, sceneGraph, SceneObject, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Alert, Icon, IconButton, Stack, Text, Tooltip } from '@grafana/ui';

import { dashboardEditActions } from '../edit-pane/shared';

import { ConditionalRendering } from './ConditionalRendering';
import { ConditionalRenderingGroup } from './ConditionalRenderingGroup';
import {
  ConditionalRenderingConditions,
  ConditionalRenderingKindTypes,
  ConditionEvaluationResult,
  ConditionValues,
  ItemsWithConditionalRendering,
} from './types';

export interface ConditionalRenderingBaseState<V = ConditionValues> extends SceneObjectState {
  value: V;
  result: ConditionEvaluationResult;
}

export abstract class ConditionalRenderingBase<
  S extends ConditionalRenderingBaseState = ConditionalRenderingBaseState,
> extends SceneObjectBase<S> {
  private _conditionalRenderingRoot: ConditionalRendering | undefined;

  protected constructor(state: S) {
    super({ ...state, result: undefined });

    this.addActivationHandler(() => this._baseActivationHandler());
  }

  private _baseActivationHandler() {
    // Similarly to the ConditionalRendering activation handler,
    // this ensures that all children are activated when conditional rendering is activated
    // We need this to allow children to subscribe to variable changes, etc.
    this.forEachChild((child) => {
      if (!child.isActive) {
        this._subs.add(child.activate());
      }
    });
  }

  public readonly supportedItemTypes: ItemsWithConditionalRendering[] | undefined = undefined;

  public abstract readonly title: string;

  // Property that controls if a hidden element should still be rendered in the DOM
  // Useful for cases like data conditions
  public readonly renderHidden: boolean = false;

  public abstract get info(): string | undefined;

  public abstract serialize(): ConditionalRenderingKindTypes;

  public abstract evaluate(): ConditionEvaluationResult;

  public recalculateResult(): ConditionEvaluationResult {
    const result = this.evaluate();

    if (result !== this.state.result) {
      this.setState({ ...this.state, result });
      this.getConditionalLogicRoot().recalculateResult();
    }

    return result;
  }

  public onDelete() {
    this.getConditionalLogicRoot().deleteItem(this);
  }

  public render(withWrapper = true): ReactElement {
    return <ConditionalRenderingBaseRenderer model={this} withWrapper={withWrapper} key={this.state.key!} />;
  }

  public getItem(): SceneObject {
    return this.getConditionalLogicRoot().getItem();
  }

  public getItemType(): ItemsWithConditionalRendering {
    return this.getConditionalLogicRoot().getItemType();
  }

  public isItemSupported(): boolean {
    if (!this.supportedItemTypes) {
      return true;
    }

    return this.supportedItemTypes.includes(this.getItemType());
  }

  public setStateAndRecalculate(state: Partial<S>) {
    this.setState(state);
    this.recalculateResult();
  }

  public findRule() {
    return this.getRenderingGroup().getRule(this.state.key!);
  }

  public undoDeleted(index: number, rule: ConditionalRenderingConditions) {
    const group = this.getRenderingGroup();
    const restoredState = [...group.state.value];
    restoredState.splice(index, 0, rule);
    group.setStateAndRecalculate({ value: restoredState });
  }

  private getRenderingGroup(): ConditionalRenderingGroup {
    // TODO: Adjust once nested rules are introduced to get relevant ConditionalRenderingGroup
    return this.getConditionalLogicRoot().state.rootGroup;
  }

  private getConditionalLogicRoot(): ConditionalRendering {
    this._conditionalRenderingRoot =
      this._conditionalRenderingRoot ?? sceneGraph.getAncestor(this, ConditionalRendering);
    return this._conditionalRenderingRoot;
  }
}

function ConditionalRenderingBaseRenderer<T extends ConditionalRenderingBase>({
  model,
  withWrapper,
}: SceneComponentProps<T> & { withWrapper: boolean }) {
  const comp = <model.Component model={model} key={model.state.key} />;

  if (!withWrapper) {
    return comp;
  }

  return (
    <Stack direction="column" key={model.state.key}>
      <Stack direction="row" gap={1}>
        <Text variant="bodySmall">{model.title}</Text>
        {model.info && (
          <Tooltip content={model.info}>
            <Icon name="info-circle" />
          </Tooltip>
        )}
      </Stack>

      <Stack direction="row" gap={1} justifyContent="stretch" alignItems="center">
        <Stack flex={1} direction="column" gap={1}>
          {comp}
          {!model.isItemSupported() && (
            <Alert severity="error" title="">
              <Trans i18nKey="dashboard.conditional-rendering.conditions.shared.unsupported-item-type">
                This condition is not supported by the element, hence it will be ignored.
              </Trans>
            </Alert>
          )}
        </Stack>

        <IconButton
          aria-label={t('dashboard.conditional-rendering.conditions.shared.delete-condition', 'Delete Condition')}
          name="trash-alt"
          onClick={() => {
            const { rule, ruleIndex } = model.findRule();

            dashboardEditActions.edit({
              description: t('dashboard.conditional-rendering.conditions.shared.delete-condition', 'Delete Condition'),
              source: model,
              perform: () => model.onDelete(),
              undo: () => {
                if (rule) {
                  model.undoDeleted(ruleIndex, rule);
                }
              },
            });
          }}
        />
      </Stack>
    </Stack>
  );
}
