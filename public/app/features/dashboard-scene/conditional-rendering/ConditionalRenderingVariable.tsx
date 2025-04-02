import { css } from '@emotion/css';
import { ReactNode, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, sceneGraph, VariableDependencyConfig } from '@grafana/scenes';
import { ConditionalRenderingVariableKind } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';
import { Combobox, ComboboxOption, Field, Input, Stack, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { ConditionHeader } from './ConditionHeader';
import { ConditionalRenderingBase, ConditionalRenderingBaseState } from './ConditionalRenderingBase';
import { handleDeleteNonGroupCondition } from './shared';

export type VariableConditionValue = {
  name: string;
  operator: '=' | '!=';
  value: string;
};

type ConditionalRenderingVariableState = ConditionalRenderingBaseState<VariableConditionValue>;

export class ConditionalRenderingVariable extends ConditionalRenderingBase<ConditionalRenderingVariableState> {
  public get title(): string {
    return t('dashboard.conditional-rendering.variable.label', 'Variable');
  }

  protected _variableDependency = new VariableDependencyConfig(this, {
    onAnyVariableChanged: (v) => {
      if (v.state.name === this.state.value.name) {
        this.getConditionalLogicRoot().notifyChange();
      }
    },
  });

  public evaluate(): boolean {
    if (!this.state.value.name) {
      return true;
    }

    const variable = sceneGraph.getVariables(this).state.variables.find((v) => v.state.name === this.state.value.name);

    // name is defined but no variable found - return false
    if (!variable) {
      return false;
    }
    const value = variable.getValue();

    let hit = Array.isArray(value) ? value.includes(this.state.value.value) : value === this.state.value.value;

    if (this.state.value.operator === '!=') {
      hit = !hit;
    }

    return hit;
  }

  public render(): ReactNode {
    return <ConditionalRenderingVariableRenderer model={this} />;
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

  public onDelete() {
    handleDeleteNonGroupCondition(this);
  }
}

function ConditionalRenderingVariableRenderer({ model }: SceneComponentProps<ConditionalRenderingVariable>) {
  const variables = useMemo(() => sceneGraph.getVariables(model), [model]);
  const variableNames = useMemo(
    () => variables.state.variables.map((v) => ({ value: v.state.name, label: v.state.label ?? v.state.name })),
    [variables.state.variables]
  );
  const operatorOptions: Array<ComboboxOption<'=' | '!='>> = useMemo(
    () => [
      { value: '=', description: t('dashboard.conditional-rendering.variable.operator.equals', 'Equals') },
      { value: '!=', description: t('dashboard.conditional-rendering.variable.operator.not-equal', 'Not equal') },
    ],
    []
  );
  const { value } = model.useState();

  const styles = useStyles2(getStyles);

  return (
    <Stack direction="column">
      <ConditionHeader title={model.title} onDelete={() => model.onDelete()} />
      <Stack direction="column">
        <Stack direction="row" gap={0.5} grow={1}>
          <Field
            label={t('dashboard.conditional-rendering.variable.select-variable', 'Select variable')}
            className={styles.variableNameSelect}
          >
            <Combobox
              options={variableNames}
              value={value.name}
              onChange={(option) => model.setStateAndNotify({ value: { ...value, name: option.value } })}
            />
          </Field>
          <Field
            label={t('dashboard.conditional-rendering.variable.select-operator', 'Operator')}
            className={styles.operatorSelect}
          >
            <Combobox
              options={operatorOptions}
              value={value.operator}
              onChange={(option) => model.setStateAndNotify({ value: { ...value, operator: option.value } })}
            />
          </Field>
        </Stack>
        <Field label={t('dashboard.conditional-rendering.variable.value-input', 'Value')}>
          <Input
            value={value.value}
            onChange={(e) => model.setStateAndNotify({ value: { ...value, value: e.currentTarget.value } })}
          />
        </Field>
      </Stack>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  variableNameSelect: css({
    flexGrow: 1,
  }),
  operatorSelect: css({
    width: theme.spacing(12),
  }),
});
