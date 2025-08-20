import { ReactElement, useEffect, useMemo, useState } from 'react';

import { t } from '@grafana/i18n';
import {
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  VariableDependencyConfig,
} from '@grafana/scenes';
import {
  ConditionalRenderingVariableKind,
  ConditionalRenderingVariableSpec,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { Box, Combobox, ComboboxOption, Field, Input, Stack } from '@grafana/ui';

import { dashboardEditActions } from '../../edit-pane/shared';
import { getLowerTranslatedObjectType } from '../object';

import { ConditionalRenderingConditionWrapper } from './ConditionalRenderingConditionWrapper';
import { ConditionalRenderingConditionsSerializerRegistryItem } from './serializers';
import { checkGroup, getObjectType } from './utils';

type VariableConditionValueOperator = '=' | '!=' | '=~' | '!~';

interface ConditionalRenderingVariableState extends SceneObjectState {
  variable: string;
  operator: VariableConditionValueOperator;
  value: string;
  result: boolean | undefined;
}

export class ConditionalRenderingVariable extends SceneObjectBase<ConditionalRenderingVariableState> {
  public static Component = ConditionalRenderingVariableRenderer;

  public static serializer: ConditionalRenderingConditionsSerializerRegistryItem = {
    id: 'ConditionalRenderingVariable',
    name: 'Variable',
    deserialize: this.deserialize,
  };

  protected _variableDependency = new VariableDependencyConfig(this, {
    onAnyVariableChanged: (v) => {
      if (v.state.name === this.state.variable) {
        this._check();
      }
    },
  });

  public constructor(state: ConditionalRenderingVariableState) {
    super(state);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    this.forEachChild((child) => {
      if (!child.isActive) {
        this._subs.add(child.activate());
      }
    });

    this._check();
  }

  public _check() {
    const result = this._evaluate();

    if (result !== this.state.result) {
      this.setState({ result });
      checkGroup(this);
    }
  }

  private _evaluate(): boolean | undefined {
    if (!this.state.variable) {
      return undefined;
    }

    const variable = sceneGraph.getVariables(this).getByName(this.state.variable);

    if (!variable) {
      return undefined;
    }

    const variableValue = variable.getValue() ?? '';

    let hit: boolean;

    if (this.state.operator === '=' || this.state.operator === '!=') {
      hit = Array.isArray(variableValue)
        ? variableValue.includes(this.state.value.toString())
        : variableValue === this.state.value.toString();
    } else {
      try {
        const regex = new RegExp(this.state.value);
        hit = Array.isArray(variableValue)
          ? variableValue.some((currentVariableValue) => regex.test(currentVariableValue.toString()))
          : regex.test(variableValue.toString());
      } catch (err) {
        return true;
      }
    }

    return this.state.operator === '!=' || this.state.operator === '!~' ? !hit : hit;
  }

  public changeVariable(variable: string) {
    if (this.state.variable !== variable) {
      this.setState({ variable });
      this._check();
    }
  }

  public changeOperator(operator: VariableConditionValueOperator) {
    if (this.state.operator !== operator) {
      this.setState({ operator });
      this._check();
    }
  }

  public changeValue(value: string) {
    if (this.state.value !== value) {
      this.setState({ value });
      this._check();
    }
  }

  public render(): ReactElement {
    return <this.Component model={this} key={this.state.key} />;
  }

  public serialize(): ConditionalRenderingVariableKind {
    return {
      kind: 'ConditionalRenderingVariable',
      spec: {
        variable: this.state.variable,
        operator: this._getLongOperator(this.state.operator),
        value: this.state.value,
      },
    };
  }

  public static deserialize(model: ConditionalRenderingVariableKind): ConditionalRenderingVariable {
    return new ConditionalRenderingVariable({
      variable: model.spec.variable,
      operator: ConditionalRenderingVariable._getShortOperator(model.spec.operator),
      value: model.spec.value,
      result: undefined,
    });
  }

  public static createEmpty(variable: string): ConditionalRenderingVariable {
    return new ConditionalRenderingVariable({ variable, operator: '=', value: '', result: undefined });
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
  const { variable, operator, value } = model.useState();

  const [newValue, setNewValue] = useState(value);

  useEffect(() => setNewValue(value), [value]);

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
    if (operator === '=~' || operator === '!~') {
      try {
        new RegExp(newValue);
        return '';
      } catch (err) {
        return t('dashboard.conditional-rendering.conditions.variable.error.invalid-regex', 'Invalid regex');
      }
    }

    return '';
  }, [newValue, operator]);

  const undoText = t('dashboard.edit-actions.edit-template-variable-rule', 'Change template variable rule');

  return (
    <ConditionalRenderingConditionWrapper
      info={t(
        'dashboard.conditional-rendering.conditions.variable.info',
        'Show or hide the {{type}} dynamically based on the variable value.',
        { type: getLowerTranslatedObjectType(getObjectType(model)) }
      )}
      isObjectSupported={true}
      model={model}
      title={t('dashboard.conditional-rendering.conditions.variable.label', 'Template variable')}
    >
      <Stack direction="column" gap={0.5}>
        <Stack direction="row" gap={0.5} grow={1}>
          <Box flex={1}>
            <Combobox
              placeholder={t('dashboard.conditional-rendering.conditions.variable.name', 'Name')}
              options={variableNames}
              value={variable}
              onChange={(option) => {
                const newVariable = option.value;

                if (newVariable !== variable) {
                  dashboardEditActions.edit({
                    description: undoText,
                    source: model,
                    perform: () => model.changeVariable(newVariable),
                    undo: () => model.changeVariable(variable),
                  });
                }
              }}
            />
          </Box>

          <Combobox
            width="auto"
            minWidth={10}
            options={operatorOptions}
            value={operator}
            onChange={(option) => {
              const newOperator = option.value;

              if (newOperator !== operator) {
                dashboardEditActions.edit({
                  description: undoText,
                  source: model,
                  perform: () => model.changeOperator(newOperator),
                  undo: () => model.changeOperator(operator),
                });
              }
            }}
          />
        </Stack>

        <Field error={valueError} invalid={!!valueError} noMargin>
          <Input
            placeholder={t('dashboard.conditional-rendering.conditions.variable.value', 'Value')}
            value={newValue}
            onChange={(evt) => {
              if (evt.currentTarget.value !== value) {
                setNewValue(evt.currentTarget.value);
              }
            }}
            onBlur={() => {
              if (newValue !== value) {
                dashboardEditActions.edit({
                  description: undoText,
                  source: model,
                  perform: () => model.changeValue(newValue),
                  undo: () => model.changeValue(value),
                });
              }
            }}
          />
        </Field>
      </Stack>
    </ConditionalRenderingConditionWrapper>
  );
}
