import { lowerCase } from 'lodash';
import { useMemo } from 'react';

import { t } from '@grafana/i18n';
import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { ConditionalRenderingGroupKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { Stack } from '@grafana/ui';

import { ConditionalRenderingChangedEvent, dashboardEditActions } from '../../edit-pane/shared';
import { ConditionalRenderingData } from '../conditions/ConditionalRenderingData';
import { ConditionalRenderingTimeRangeSize } from '../conditions/ConditionalRenderingTimeRangeSize';
import { ConditionalRenderingVariable } from '../conditions/ConditionalRenderingVariable';
import { conditionalRenderingSerializerRegistry } from '../conditions/serializers';
import { ConditionalRenderingConditions } from '../conditions/types';
import { getObjectType, getTranslatedObjectType } from '../object';

import { ConditionalRenderingGroupAdd } from './ConditionalRenderingGroupAdd';
import { ConditionalRenderingGroupCondition } from './ConditionalRenderingGroupCondition';
import { ConditionalRenderingGroupVisibility } from './ConditionalRenderingGroupVisibility';
import { GroupConditionCondition, GroupConditionConditionType, GroupConditionVisibility } from './types';

export interface ConditionalRenderingGroupState extends SceneObjectState {
  conditions: ConditionalRenderingConditions[];
  visibility: GroupConditionVisibility;
  condition: GroupConditionCondition;
  renderHidden: boolean;
  result: boolean;
}

export class ConditionalRenderingGroup extends SceneObjectBase<ConditionalRenderingGroupState> {
  public static Component = ConditionalRenderingGroupRenderer;

  private _shouldShow: boolean;
  private _shouldMatchAll: boolean;

  public constructor(state: ConditionalRenderingGroupState) {
    super(state);
    this._shouldShow = state.visibility === 'show';
    this._shouldMatchAll = state.condition === 'and';

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    this.forEachChild((child) => {
      if (!child.isActive) {
        this._subs.add(child.activate());
      }
    });

    this.check();
  }

  public check() {
    let result =
      this.state.conditions.length === 0
        ? true
        : this._shouldMatchAll
          ? this.state.conditions.every((condition) => this._evaluateCondition(condition))
          : this.state.conditions.some((condition) => this._evaluateCondition(condition));

    if (result !== this.state.result) {
      this.setState({ ...this.state, result });
      this.publishEvent(new ConditionalRenderingChangedEvent(this), true);
    }
  }

  public changeVisibility(visibility: GroupConditionVisibility) {
    if (visibility !== this.state.visibility) {
      this._shouldShow = visibility === 'show';
      this.setState({ visibility });
      this.check();
    }
  }

  public changeCondition(condition: GroupConditionCondition) {
    if (condition !== this.state.condition) {
      this._shouldMatchAll = condition === 'and';
      this.setState({ condition });
      this.check();
    }
  }

  public createCondition(conditionType: GroupConditionConditionType): ConditionalRenderingConditions {
    switch (conditionType) {
      case 'data':
        return ConditionalRenderingData.createEmpty();

      case 'timeRangeSize':
        return ConditionalRenderingTimeRangeSize.createEmpty();

      case 'variable':
        return ConditionalRenderingVariable.createEmpty(sceneGraph.getVariables(this).state.variables[0].state.name);
    }
  }

  public addCondition(condition: ConditionalRenderingConditions) {
    const conditions = [...this.state.conditions, condition];
    this.setState({
      conditions,
      renderHidden: conditions.some((condition) => condition instanceof ConditionalRenderingData),
    });

    if (this.isActive && !condition.isActive) {
      condition.activate();
    }

    this.check();
  }

  public removeCondition(condition: ConditionalRenderingConditions) {
    const conditions = this.state.conditions.filter((currentCondition) => currentCondition !== condition);

    this.setState({
      conditions,
      renderHidden: conditions.some((condition) => condition instanceof ConditionalRenderingData),
    });
    this.check();
  }

  public undoRemoveCondition(condition: ConditionalRenderingConditions, index: number) {
    const conditions = [...this.state.conditions];
    conditions.splice(index, 0, condition);
    this.setState({ conditions });
    this.check();
  }

  public removeLastCondition() {
    const conditions = [...this.state.conditions];
    conditions.pop();
    this.setState({ conditions });
    this.check();
  }

  public getConditionIndex(condition: ConditionalRenderingConditions): number {
    return this.state.conditions.findIndex((currentCondition) => currentCondition === condition);
  }

  public serialize(): ConditionalRenderingGroupKind {
    return {
      kind: 'ConditionalRenderingGroup',
      spec: {
        visibility: this.state.visibility,
        condition: this.state.condition,
        items: this.state.conditions.map((condition) => condition.serialize()),
      },
    };
  }

  private _evaluateCondition(condition: ConditionalRenderingConditions): boolean {
    const { result } = condition.state;

    // When the result is undefined, we consider it to be truthy
    if (result === undefined) {
      return true;
    }

    return result === this._shouldShow;
  }

  public static createEmpty(): ConditionalRenderingGroup {
    return new ConditionalRenderingGroup({
      condition: 'and',
      visibility: 'show',
      conditions: [],
      result: true,
      renderHidden: false,
    });
  }

  public static deserialize(model: ConditionalRenderingGroupKind): ConditionalRenderingGroup {
    const conditions = model.spec.items.map((item) =>
      conditionalRenderingSerializerRegistry.get(item.kind).deserialize(item)
    );

    return new ConditionalRenderingGroup({
      condition: model.spec.condition,
      visibility: model.spec.visibility,
      conditions,
      result: true,
      renderHidden: conditions.some((condition) => condition instanceof ConditionalRenderingData),
    });
  }
}

function ConditionalRenderingGroupRenderer({ model }: SceneComponentProps<ConditionalRenderingGroup>) {
  const { condition, visibility, conditions } = model.useState();
  const { variables } = sceneGraph.getVariables(model).useState();
  const objectType = useMemo(() => getObjectType(model.parent), [model]);

  return (
    <Stack direction="column" gap={2}>
      <ConditionalRenderingGroupVisibility
        objectType={objectType}
        value={visibility}
        onChange={(value) => {
          dashboardEditActions.edit({
            description: t('dashboard.conditional-rendering.conditions.group.visibility.label', '{{type}} visibility', {
              type: getTranslatedObjectType(objectType),
            }),
            source: model,
            perform: () => model.changeVisibility(value),
            undo: () => model.changeVisibility(visibility),
          });
        }}
      />
      {conditions.length > 1 && (
        <ConditionalRenderingGroupCondition
          value={condition}
          onChange={(value) => {
            dashboardEditActions.edit({
              description: t('dashboard.conditional-rendering.conditions.group.condition.label', 'Match rules'),
              source: model,
              perform: () => model.changeCondition(value),
              undo: () => model.changeCondition(condition),
            });
          }}
        />
      )}
      {conditions.map((currentCondition) => currentCondition.render())}
      <ConditionalRenderingGroupAdd
        objectType={objectType}
        hasVariables={variables.length > 0}
        onAdd={({ value, label }) => {
          const condition = model.createCondition(value!);

          dashboardEditActions.edit({
            description: t('dashboard.edit-actions.add-conditional-rule', 'Add {{ruleDescription}} rule', {
              ruleDescription: lowerCase(label),
            }),
            source: model,
            perform: () => model.addCondition(condition),
            undo: () => model.removeLastCondition(),
          });
        }}
      />
    </Stack>
  );
}
