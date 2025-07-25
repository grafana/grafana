import { t } from '@grafana/i18n';
import { SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { ConditionalRenderingGroupKind } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';
import { Stack } from '@grafana/ui';

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

  public constructor(state: Omit<ConditionalRenderingGroupState, 'result' | 'force'>) {
    super({ ...state, result: true, force: true });
  }

  public evaluate(): ConditionEvaluationResult {
    if (this.state.value.length === 0) {
      return this.getForceTrue();
    }

    const shouldShow = this.state.visibility === 'show';

    return this.getActualResult(
      this.state.condition === 'and'
        ? this.state.value.every((entry) => this._evaluateCondition(entry, shouldShow))
        : this.state.value.some((entry) => this._evaluateCondition(entry, shouldShow))
    );
  }

  public changeVisibility(visibility: GroupConditionVisibility) {
    this.setStateAndRecalculate({ visibility });
  }

  public changeCondition(condition: GroupConditionCondition) {
    this.setStateAndRecalculate({ condition });
  }

  public addItem(itemType: GroupConditionItemType) {
    const item =
      itemType === 'data'
        ? ConditionalRenderingData.createEmpty()
        : itemType === 'variable'
          ? ConditionalRenderingVariable.createEmpty(sceneGraph.getVariables(this).state.variables[0].state.name)
          : ConditionalRenderingTimeRangeSize.createEmpty();

    // We don't use `setStateAndNotify` here because
    // We need to set a parent and activate the new condition before notifying the root
    this.setState({ value: [...this.state.value, item] });

    if (this.isActive && !item.isActive) {
      item.activate();
    }

    this.recalculateResult();
  }

  public removeItem(key: string) {
    this.setStateAndRecalculate({ value: this.state.value.filter((condition) => condition.state.key !== key) });
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

  // This function evaluates a given condition
  // If the `force` flag is set, that means we should respect the result of the condition and we don't care about the `shouldShow` flag
  // This helps with cases where a condition returns a result for an arbitrary case and not an evaluation per-se
  // i.e. a variable condition where the variable is not found, a data condition where there is no data provider etc.
  private _evaluateCondition(entry: ConditionalRenderingConditions, shouldShow: boolean): boolean {
    const { result, force } = entry.state;

    if (force) {
      return result;
    }

    return shouldShow ? result : !result;
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
    });
  }

  public static createEmpty(): ConditionalRenderingGroup {
    return new ConditionalRenderingGroup({ condition: 'and', visibility: 'show', value: [] });
  }
}

function ConditionalRenderingGroupRenderer({ model }: SceneComponentProps<ConditionalRenderingGroup>) {
  const { condition, visibility, value } = model.useState();
  const { variables } = sceneGraph.getVariables(model).useState();

  return (
    <Stack direction="column" gap={2}>
      <ConditionalRenderingGroupVisibility
        itemType={model.getItemType()}
        value={visibility}
        onChange={(value) => model.changeVisibility(value)}
      />
      {value.length > 1 && (
        <ConditionalRenderingGroupCondition value={condition} onChange={(value) => model.changeCondition(value)} />
      )}
      {value.map((entry) => entry.render())}
      <ConditionalRenderingGroupAdd
        itemType={model.getItemType()}
        hasVariables={variables.length > 0}
        onAdd={(itemType) => model.addItem(itemType)}
      />
    </Stack>
  );
}
