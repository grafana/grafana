import { useMemo, useState } from 'react';

import { sceneGraph, SceneObject, SceneVariable } from '@grafana/scenes';
import { Button, Combobox, ComboboxOption, Field, FieldSet, Input, Modal } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { t } from 'app/core/internationalization';
import { ShowModalReactEvent } from 'app/types/events';

import { VariableConditionValueOperator } from './ConditionalRenderingVariable';

interface Props {
  defaultValues?: {
    name: string;
    operator: VariableConditionValueOperator;
    value: string;
  };
  variables: SceneVariable[];
  onDismiss: () => void;
  onSave: (variableName: string, operator: VariableConditionValueOperator, value: string) => void;
}

export const ConditionalRenderingVariableEditor = ({ defaultValues, variables, onDismiss, onSave }: Props) => {
  const names: Array<ComboboxOption<string>> = useMemo(
    () => variables.map((v) => ({ value: v.state.name, label: v.state.label ?? v.state.name })),
    [variables]
  );

  const operators: Array<ComboboxOption<VariableConditionValueOperator>> = useMemo(
    () => [
      { value: '=', description: t('dashboard.conditional-rendering.variable.editor.operator.equals', 'Equals') },
      {
        value: '!=',
        description: t('dashboard.conditional-rendering.variable.editor.operator.not-equal', 'Not equal'),
      },
    ],
    []
  );

  const [name, setName] = useState(
    defaultValues?.name ? (names.find((n) => n.value === defaultValues.name) ?? names[0]) : names[0]
  );

  const [operator, setOperator] = useState(
    defaultValues?.operator ? (operators.find((o) => o.value === defaultValues.operator) ?? operators[0]) : operators[0]
  );

  const [value, setValue] = useState(defaultValues?.value ?? '');

  const isNew = !defaultValues;

  return (
    <Modal
      isOpen
      onDismiss={onDismiss}
      title={
        isNew
          ? t('dashboard.conditional-rendering.variable.editor.title.add', 'Add variable condition')
          : t('dashboard.conditional-rendering.variable.editor.title.edit', 'Edit variable condition')
      }
    >
      <FieldSet>
        <Field label={t('dashboard.conditional-rendering.variable.editor.name.label', 'Name')}>
          <Combobox isClearable={false} createCustomValue={false} value={name} options={names} onChange={setName} />
        </Field>
        <Field label={t('dashboard.conditional-rendering.variable.editor.operator.label', 'Operator')}>
          <Combobox
            isClearable={false}
            createCustomValue={false}
            value={operator}
            options={operators}
            onChange={setOperator}
          />
        </Field>
        <Field label={t('dashboard.conditional-rendering.variable.editor.value.label', 'Value')}>
          <Input value={value} onChange={(evt) => setValue(evt.currentTarget.value ?? '')} />
        </Field>
      </FieldSet>
      <Modal.ButtonRow>
        <Button onClick={onDismiss} variant="secondary" type="button" fill="outline">
          {isNew
            ? t('dashboard.conditional-rendering.variable.editor.button.cancel', 'Cancel')
            : t('dashboard.conditional-rendering.variable.editor.button.discard', 'Discard')}
        </Button>
        <Button
          onClick={() => {
            onSave(name.value, operator.value, value);
            onDismiss();
          }}
          type="button"
          variant="primary"
          disabled={!name}
        >
          {isNew
            ? t('dashboard.conditional-rendering.variable.editor.button.add', 'Add')
            : t('dashboard.conditional-rendering.variable.editor.button.save', 'Save')}
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};

export const showConditionalRenderingVariableEditor = (
  sceneObject: SceneObject,
  props: Omit<Props, 'variables' | 'onDismiss'>
) =>
  appEvents.publish(
    new ShowModalReactEvent({
      component: ConditionalRenderingVariableEditor,
      props: { ...props, variables: sceneGraph.getVariables(sceneObject).state.variables },
    })
  );
