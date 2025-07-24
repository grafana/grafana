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
  result: boolean;
  force: boolean;
}

export abstract class ConditionalRenderingBase<
  S extends ConditionalRenderingBaseState = ConditionalRenderingBaseState,
> extends SceneObjectBase<S> {
  public constructor(state: S) {
    super({ ...state, result: true, force: true });

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

  public abstract get info(): string | undefined;

  public abstract serialize(): ConditionalRenderingKindTypes;

  public abstract evaluate(): ConditionEvaluationResult;

  public getForceTrue(): ConditionEvaluationResult {
    return { result: true, force: true };
  }

  public getForceFalse(): ConditionEvaluationResult {
    return { result: false, force: true };
  }

  public getActualResult(result: boolean): ConditionEvaluationResult {
    return { result, force: false };
  }

  public recalculateResult(): ConditionEvaluationResult {
    const result = this.evaluate();

    if (result.result !== this.state.result || result.force !== this.state.force) {
      this.setState({ ...this.state, result: result.result, force: result.force });
      this._notifyChange();
    }

    return result;
  }

  public onDelete() {
    this._getConditionalLogicRoot().deleteItem(this);
  }

  public render(withWrapper = true): ReactElement {
    return <ConditionalRenderingBaseRenderer model={this} withWrapper={withWrapper} key={this.state.key!} />;
  }

  public getItem(): SceneObject {
    return this._getConditionalLogicRoot().getItem();
  }

  public getItemType(): ItemsWithConditionalRendering {
    return this._getConditionalLogicRoot().getItemType();
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
    return this._getConditionalLogicRoot().state.rootGroup;
  }

  private _getConditionalLogicRoot(): ConditionalRendering {
    return sceneGraph.getAncestor(this, ConditionalRendering);
  }

  private _notifyChange() {
    this._getConditionalLogicRoot().notifyChange();
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
