import { useMemo } from 'react';

import { SceneComponentProps, sceneGraph, VariableDependencyConfig } from '@grafana/scenes';
import { ConditionalRenderingVariableKind } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';
import { Box, Combobox, ComboboxOption, Input, Stack } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { ConditionalRenderingBase, ConditionalRenderingBaseState } from './ConditionalRenderingBase';
import {
  ConditionalRenderingSerializerRegistryItem,
  VariableConditionValue,
  VariableConditionValueOperator,
} from './types';

type ConditionalRenderingVariableState = ConditionalRenderingBaseState<VariableConditionValue>;

export class ConditionalRenderingVariable extends ConditionalRenderingBase<ConditionalRenderingVariableState> {
  public static Component = ConditionalRenderingVariableRenderer;

  public static serializer: ConditionalRenderingSerializerRegistryItem = {
    id: 'ConditionalRenderingVariable',
    name: 'Variable',
    deserialize: this.deserialize,
  };

  public get title(): string {
    return t('dashboard.conditional-rendering.conditions.variable.label', 'Template variable');
  }

  public get info(): string {
    return t(
      'dashboard.conditional-rendering.conditions.variable.info',
      'Show or hide the {{type}} dynamically based on the variable value.',
      { type: this.getItemType() }
    );
  }

  protected _variableDependency = new VariableDependencyConfig(this, {
    onAnyVariableChanged: (v) => {
      if (v.state.name === this.state.value.name) {
        this.notifyChange();
      }
    },
  });

  public evaluate(): boolean {
    if (!this.state.value.name) {
      return true;
    }

    const variable = sceneGraph.getVariables(this).getByName(this.state.value.name);

    if (!variable) {
      return false;
    }

    const variableValue = variable.getValue() ?? '';

    const hit = Array.isArray(variableValue)
      ? variableValue.includes(this.state.value.value)
      : variableValue === this.state.value.value;

    return this.state.value.operator === '!=' ? !hit : hit;
  }

  public serialize(): ConditionalRenderingVariableKind {
    return {
      kind: 'ConditionalRenderingVariable',
      spec: {
        variable: this.state.value.name,
        operator: this.state.value.operator === '=' ? 'equals' : 'notEquals',
        value: this.state.value.value,
      },
    };
  }

  public static deserialize(model: ConditionalRenderingVariableKind): ConditionalRenderingVariable {
    return new ConditionalRenderingVariable({
      value: {
        name: model.spec.variable,
        operator: model.spec.operator === 'equals' ? '=' : '!=',
        value: model.spec.value,
      },
    });
  }

  public static createEmpty(name: string): ConditionalRenderingVariable {
    return new ConditionalRenderingVariable({ value: { name, operator: '=', value: '' } });
  }
}

function ConditionalRenderingVariableRenderer({ model }: SceneComponentProps<ConditionalRenderingVariable>) {
  const { value } = model.useState();

  const variables = useMemo(() => sceneGraph.getVariables(model), [model]);

  const variableNames: Array<ComboboxOption<string>> = useMemo(
    () => variables.state.variables.map((v) => ({ value: v.state.name, label: v.state.label ?? v.state.name })),
    [variables.state.variables]
  );

  const operatorOptions: Array<ComboboxOption<VariableConditionValueOperator>> = useMemo(
    () => [
      { value: '=', description: t('dashboard.conditional-rendering.conditions.variable.operator.equals', 'Equals') },
      {
        value: '!=',
        description: t('dashboard.conditional-rendering.conditions.variable.operator.not-equals', 'Not equals'),
      },
    ],
    []
  );

  return (
    <Stack direction="column" gap={0.5}>
      <Stack direction="row" gap={0.5} grow={1}>
        <Box flex={1}>
          <Combobox
            placeholder={t('dashboard.conditional-rendering.conditions.variable.name', 'Name')}
            options={variableNames}
            value={value.name}
            onChange={(option) => model.setStateAndNotify({ value: { ...value, name: option.value } })}
          />
        </Box>

        <Combobox
          width="auto"
          minWidth={10}
          options={operatorOptions}
          value={value.operator}
          onChange={(option) => model.setStateAndNotify({ value: { ...value, operator: option.value } })}
        />
      </Stack>
      <Input
        placeholder={t('dashboard.conditional-rendering.conditions.variable.value', 'Value')}
        value={value.value}
        onChange={(e) => model.setStateAndNotify({ value: { ...value, value: e.currentTarget.value } })}
      />
    </Stack>
  );
}
