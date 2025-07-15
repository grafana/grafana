import { useMemo } from 'react';

import { t } from '@grafana/i18n';
import { SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { ConditionalRenderingScopesKind } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';
import { Combobox, ComboboxOption, Input, Stack } from '@grafana/ui';

import { ConditionalRenderingBase, ConditionalRenderingBaseState } from './ConditionalRenderingBase';
import {
  ConditionalRenderingSerializerRegistryItem,
  ScopesConditionValue,
  ScopesConditionValueOperator,
} from './types';

type ConditionalRenderingScopesState = ConditionalRenderingBaseState<ScopesConditionValue>;

export class ConditionalRenderingScopes extends ConditionalRenderingBase<ConditionalRenderingScopesState> {
  public static Component = ConditionalRenderingScopesRenderer;

  public static serializer: ConditionalRenderingSerializerRegistryItem = {
    id: 'ConditionalRenderingScopes',
    name: 'Scopes',
    deserialize: this.deserialize,
  };

  public get title(): string {
    return t('dashboard.conditional-rendering.conditions.scopes.label', 'Scopes');
  }

  public get info(): string {
    return t(
      'dashboard.conditional-rendering.conditions.scopes.info',
      'Show or hide the {{type}} dynamically based on the selected scopes.',
      { type: this.getItemType() }
    );
  }

  public evaluate(): boolean {
    if (!this.state.value.value) {
      return true;
    }

    const scopes = sceneGraph.getScopes(this);

    if (!scopes) {
      return true;
    }

    const hit = scopes.some((scope) => scope.metadata.name === this.state.value.value);

    return this.state.value.operator === 'notIncludes' ? !hit : hit;
  }

  public serialize(): ConditionalRenderingScopesKind {
    return {
      kind: 'ConditionalRenderingScopes',
      spec: {
        operator: this.state.value.operator,
        value: this.state.value.value,
      },
    };
  }

  public static deserialize(model: ConditionalRenderingScopesKind): ConditionalRenderingScopes {
    return new ConditionalRenderingScopes({
      value: {
        operator: model.spec.operator,
        value: model.spec.value,
      },
    });
  }

  public static createEmpty(): ConditionalRenderingScopes {
    return new ConditionalRenderingScopes({ value: { operator: 'includes', value: '' } });
  }
}

function ConditionalRenderingScopesRenderer({ model }: SceneComponentProps<ConditionalRenderingScopes>) {
  const { value } = model.useState();

  const operatorOptions: Array<ComboboxOption<ScopesConditionValueOperator>> = useMemo(
    () => [
      {
        value: 'includes',
        description: t('dashboard.conditional-rendering.conditions.scopes.operator.includes', 'Includes'),
      },
      {
        value: 'notIncludes',
        description: t('dashboard.conditional-rendering.conditions.scopes.operator.not-includes', 'Not includes'),
      },
    ],
    []
  );

  return (
    <Stack direction="column" gap={0.5}>
      <Stack direction="row" gap={0.5} grow={1}>
        <Combobox
          width="auto"
          minWidth={10}
          options={operatorOptions}
          value={value.operator}
          onChange={(option) => model.setStateAndNotify({ value: { ...value, operator: option.value } })}
        />
      </Stack>
      <Input
        placeholder={t('dashboard.conditional-rendering.conditions.scopes.value', 'Scope name')}
        value={value.value}
        onChange={(e) => model.setStateAndNotify({ value: { ...value, value: e.currentTarget.value } })}
      />
    </Stack>
  );
}
