import { useEffect, useMemo, useState } from 'react';

import { t } from '@grafana/i18n';
import { SceneComponentProps, sceneGraph, VariableDependencyConfig } from '@grafana/scenes';
import {
  ConditionalRenderingVariableKind,
  ConditionalRenderingVariableSpec,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { Box, Combobox, ComboboxOption, Field, Input, Stack } from '@grafana/ui';

import { dashboardEditActions } from '../edit-pane/shared';

import { ConditionalRenderingBase, ConditionalRenderingBaseState } from './ConditionalRenderingBase';
import {
  ConditionalRenderingSerializerRegistryItem,
  ConditionEvaluationResult,
  VariableConditionValue,
  VariableConditionValueOperator,
} from './types';
import { translatedItemType } from './utils';

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
      { type: translatedItemType(this.getItemType()) }
    );
  }

  protected _variableDependency = new VariableDependencyConfig(this, {
    onAnyVariableChanged: (v) => {
      if (v.state.name === this.state.value.name) {
        this.recalculateResult();
      }
    },
  });

  public constructor(state: Omit<ConditionalRenderingVariableState, 'result' | 'force'>) {
    super({ ...state, result: true, force: true });
  }

  public evaluate(): ConditionEvaluationResult {
    if (!this.state.value.name) {
      return this.getForceTrue();
    }

    const variable = sceneGraph.getVariables(this).getByName(this.state.value.name);

    if (!variable) {
      return this.getForceTrue();
    }

    const variableValue = variable.getValue() ?? '';

    let hit: boolean;

    if (this.state.value.operator === '=' || this.state.value.operator === '!=') {
      hit = Array.isArray(variableValue)
        ? variableValue.includes(this.state.value.value.toString())
        : variableValue === this.state.value.value.toString();
    } else {
      try {
        const regex = new RegExp(this.state.value.value);
        hit = Array.isArray(variableValue)
          ? variableValue.some((currentVariableValue) => regex.test(currentVariableValue.toString()))
          : regex.test(variableValue.toString());
      } catch (err) {
        return true;
      }
    }

    return this.state.value.operator === '!=' || this.state.value.operator === '!~' ? !hit : hit;
  }

  public serialize(): ConditionalRenderingVariableKind {
    return {
      kind: 'ConditionalRenderingVariable',
      spec: {
        variable: this.state.value.name,
        operator: this._getLongOperator(this.state.value.operator),
        value: this.state.value.value,
      },
    };
  }

  public static deserialize(model: ConditionalRenderingVariableKind): ConditionalRenderingVariable {
    return new ConditionalRenderingVariable({
      value: {
        name: model.spec.variable,
        operator: ConditionalRenderingVariable._getShortOperator(model.spec.operator),
        value: model.spec.value,
      },
    });
  }

  public static createEmpty(name: string): ConditionalRenderingVariable {
    return new ConditionalRenderingVariable({ value: { name, operator: '=', value: '' } });
  }

  private _getLongOperator(operator: VariableConditionValueOperator): ConditionalRenderingVariableSpec['operator'] {
    switch (operator) {
      case '=':
        return 'equals';

      case '!=':
        return 'notEquals';

      case '=~':
        return 'matches';

      case '!~':
        return 'notMatches';
    }
  }

  private static _getShortOperator(
    operator: ConditionalRenderingVariableSpec['operator']
  ): VariableConditionValueOperator {
    switch (operator) {
      case 'equals':
        return '=';

      case 'notEquals':
        return '!=';

      case 'matches':
        return '=~';

      case 'notMatches':
        return '!~';
    }
  }
}

function ConditionalRenderingVariableRenderer({ model }: SceneComponentProps<ConditionalRenderingVariable>) {
  const { value } = model.useState();

  const [actualValue, setActualValue] = useState(value.value);

  useEffect(() => {
    setActualValue(value.value);
  }, [value.value]);

  const variables = useMemo(() => sceneGraph.getVariables(model), [model]);

  const variableNames: ComboboxOption[] = useMemo(
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
      {
        value: '=~',
        description: t('dashboard.conditional-rendering.conditions.variable.operator.matches', 'Matches'),
      },
      {
        value: '!~',
        description: t('dashboard.conditional-rendering.conditions.variable.operator.not-matches', 'Not matches'),
      },
    ],
    []
  );

  const valueError = useMemo(() => {
    if (value.operator === '=~' || value.operator === '!~') {
      try {
        new RegExp(actualValue);
        return '';
      } catch (err) {
        return t('dashboard.conditional-rendering.conditions.variable.error.invalid-regex', 'Invalid regex');
      }
    }

    return '';
  }, [actualValue, value.operator]);

  const undoText = t('dashboard.edit-actions.edit-template-variable-rule', 'Change template variable rule');

  return (
    <Stack direction="column" gap={0.5}>
      <Stack direction="row" gap={0.5} grow={1}>
        <Box flex={1}>
          <Combobox
            placeholder={t('dashboard.conditional-rendering.conditions.variable.name', 'Name')}
            options={variableNames}
            value={value.name}
            onChange={(option) => {
              if (option.value !== value.name) {
                dashboardEditActions.edit({
                  description: undoText,
                  source: model,
                  perform: () => model.setStateAndRecalculate({ value: { ...value, name: option.value } }),
                  undo: () => model.setStateAndRecalculate({ value: { ...value, name: value.name } }),
                });
              }
            }}
          />
        </Box>

        <Combobox
          width="auto"
          minWidth={10}
          options={operatorOptions}
          value={value.operator}
          onChange={(option) => {
            if (option.value !== value.operator) {
              dashboardEditActions.edit({
                description: undoText,
                source: model,
                perform: () => model.setStateAndRecalculate({ value: { ...value, operator: option.value } }),
                undo: () => model.setStateAndRecalculate({ value: { ...value, operator: value.operator } }),
              });
            }
          }}
        />
      </Stack>
      <Field error={valueError} invalid={!!valueError} noMargin>
        <Input
          placeholder={t('dashboard.conditional-rendering.conditions.variable.value', 'Value')}
          value={actualValue}
          onChange={(evt) => {
            if (evt.currentTarget.value !== value.value) {
              setActualValue(evt.currentTarget.value);
            }
          }}
          onBlur={() => {
            if (actualValue !== value.value) {
              dashboardEditActions.edit({
                description: undoText,
                source: model,
                perform: () => model.setStateAndRecalculate({ value: { ...value, value: actualValue } }),
                undo: () => model.setStateAndRecalculate({ value: { ...value, value: value.value } }),
              });
            }
          }}
        />
      </Field>
    </Stack>
  );
}
