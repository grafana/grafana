import { capitalize, lowerCase } from 'lodash';
import { useMemo } from 'react';

import { t } from '@grafana/i18n';
import { SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { ConditionalRenderingGroupKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { Stack } from '@grafana/ui';

import { dashboardEditActions } from '../edit-pane/shared';

import { ConditionalRenderingBase, ConditionalRenderingBaseState } from './ConditionalRenderingBase';
import { ConditionalRenderingData } from './ConditionalRenderingData';
import { ConditionalRenderingGroupAdd } from './ConditionalRenderingGroupAdd';
import { ConditionalRenderingGroupCondition } from './ConditionalRenderingGroupCondition';
import { ConditionalRenderingGroupVisibility } from './ConditionalRenderingGroupVisibility';
import { ConditionalRenderingTimeRangeSize } from './ConditionalRenderingTimeRangeSize';
import { ConditionalRenderingVariable } from './ConditionalRenderingVariable';
import { conditionalRenderingSerializerRegistry } from './serializers';
import {
  ConditionalRenderingKindTypes,
  ConditionalRenderingSerializerRegistryItem,
  GroupConditionCondition,
  GroupConditionItemType,
  GroupConditionVisibility,
  GroupConditionValue,
  ConditionEvaluationResult,
  ConditionalRenderingConditions,
} from './types';
import { translatedItemType } from './utils';

export interface ConditionalRenderingGroupState extends ConditionalRenderingBaseState<GroupConditionValue> {
  visibility: GroupConditionVisibility;
  condition: GroupConditionCondition;
}

export class ConditionalRenderingGroup extends ConditionalRenderingBase<ConditionalRenderingGroupState> {
  public static Component = ConditionalRenderingGroupRenderer;

  public static serializer: ConditionalRenderingSerializerRegistryItem = {
    id: 'ConditionalRenderingGroup',
    name: 'Group',
    deserialize: this.deserialize,
  };

  public get title(): string {
    return t('dashboard.conditional-rendering.conditions.group.label', 'Group');
  }

  public get info(): undefined {
    return undefined;
  }

  private _shouldShow: boolean;
  private _shouldMatchAll: boolean;

  public constructor(state: ConditionalRenderingGroupState) {
    super(state);
    this._shouldShow = state.visibility === 'show';
    this._shouldMatchAll = state.condition === 'and';
  }

  public evaluate(): ConditionEvaluationResult {
    if (this.state.value.length === 0) {
      return undefined;
    }

    return this._shouldMatchAll
      ? this.state.value.every((item) => this._evaluateItem(item))
      : this.state.value.some((item) => this._evaluateItem(item));
  }

  public changeVisibility(visibility: GroupConditionVisibility) {
    if (visibility !== this.state.visibility) {
      this._shouldShow = visibility === 'show';
      this.setStateAndRecalculate({ visibility });
    }
  }

  public changeCondition(condition: GroupConditionCondition) {
    if (condition !== this.state.condition) {
      this._shouldMatchAll = condition === 'and';
      this.setStateAndRecalculate({ condition });
    }
  }

  public createItem(itemType: GroupConditionItemType): ConditionalRenderingConditions {
    switch (itemType) {
      case 'data':
        return ConditionalRenderingData.createEmpty();

      case 'timeRangeSize':
        return ConditionalRenderingTimeRangeSize.createEmpty();

      case 'variable':
        return ConditionalRenderingVariable.createEmpty(sceneGraph.getVariables(this).state.variables[0].state.name);
    }
  }

  public addItem(item: ConditionalRenderingConditions) {
    // We don't use `setStateAndNotify` here because
    // We need to set a parent and activate the new condition before notifying the root
    this.setState({ value: [...this.state.value, item] });

    if (this.isActive && !item.isActive) {
      item.activate();
    }

    this.recalculateResult();
  }

  public deleteItem(key: string) {
    this.setStateAndRecalculate({ value: this.state.value.filter((condition) => condition.state.key !== key) });
  }

  public removeLastItem() {
    const newValues = [...this.state.value];
    newValues.pop();
    this.setStateAndNotify({ value: newValues });
  }

  public getRule(key: string) {
    const ruleIndex = this.state.value.findIndex((rule) => rule.state.key === key);
    const rule = this.state.value[ruleIndex];
    return { rule, ruleIndex };
  }

  public serialize(): ConditionalRenderingGroupKind {
    if (this.state.value.some((item) => item instanceof ConditionalRenderingGroup)) {
      throw new Error('ConditionalRenderingGroup cannot contain nested ConditionalRenderingGroups');
    }

    return {
      kind: 'ConditionalRenderingGroup',
      spec: {
        visibility: this.state.visibility,
        condition: this.state.condition,
        items: this.state.value
          .map((condition) => condition.serialize())
          .filter((item) => item.kind !== 'ConditionalRenderingGroup'),
      },
    };
  }

  private _evaluateItem(item: ConditionalRenderingConditions): boolean {
    const { result } = item.state;

    // When the result is undefined, we consider it to be truthy
    if (result === undefined) {
      return true;
    }

    return result === this._shouldShow;
  }

  public static deserialize(model: ConditionalRenderingGroupKind): ConditionalRenderingGroup {
    return new ConditionalRenderingGroup({
      condition: model.spec.condition,
      visibility: model.spec.visibility,
      value: model.spec.items.map((item: ConditionalRenderingKindTypes) => {
        const serializerRegistryItem = conditionalRenderingSerializerRegistry.getIfExists(item.kind);

        if (!serializerRegistryItem) {
          throw new Error(`No serializer found for conditional rendering kind: ${item.kind}`);
        }

        return serializerRegistryItem.deserialize(item);
      }),
      result: undefined,
    });
  }

  public static createEmpty(): ConditionalRenderingGroup {
    return new ConditionalRenderingGroup({ condition: 'and', visibility: 'show', value: [], result: undefined });
  }
}

function ConditionalRenderingGroupRenderer({ model }: SceneComponentProps<ConditionalRenderingGroup>) {
  const { condition, visibility, value } = model.useState();
  const { variables } = sceneGraph.getVariables(model).useState();
  const itemType = useMemo(() => model.getItemType(), [model]);

  return (
    <Stack direction="column" gap={2}>
      <ConditionalRenderingGroupVisibility
        itemType={itemType}
        value={visibility}
        onChange={(value) => {
          dashboardEditActions.edit({
            description: t('dashboard.conditional-rendering.conditions.group.visibility.label', '{{type}} visibility', {
              type: capitalize(translatedItemType(itemType)),
            }),
            source: model,
            perform: () => model.changeVisibility(value),
            undo: () => model.changeVisibility(visibility),
          });
        }}
      />
      {value.length > 1 && (
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
      {value.map((entry) => entry.render())}
      <ConditionalRenderingGroupAdd
        itemType={itemType}
        hasVariables={variables.length > 0}
        onAdd={({ value, label }) => {
          const item = model.createItem(value!);
          dashboardEditActions.edit({
            description: t('dashboard.edit-actions.add-conditional-rule', 'Add {{ruleDescription}} rule', {
              ruleDescription: lowerCase(label),
            }),
            source: model,
            perform: () => model.addItem(item),
            undo: () => model.removeLastItem(),
          });
        }}
      />
    </Stack>
  );
}
