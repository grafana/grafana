import { type FormEvent, useRef } from 'react';
import { lastValueFrom } from 'rxjs';

import { t } from '@grafana/i18n';
import { ConstantVariable, type SceneVariable } from '@grafana/scenes';
import { Input } from '@grafana/ui';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { undoableVariableEdit } from '../../../actions/variable/undoableVariableEdit';
import { ConstantVariableForm } from '../components/ConstantVariableForm';

interface ConstantVariableEditorProps {
  variable: ConstantVariable;
}

export function ConstantVariableEditor({ variable }: ConstantVariableEditorProps) {
  const { value } = variable.useState();

  const onConstantValueChange = (event: FormEvent<HTMLInputElement>) => {
    variable.setState({ value: event.currentTarget.value });
  };

  return <ConstantVariableForm constantValue={value.toString()} onChange={onConstantValueChange} />;
}

export function getConstantVariableOptions(variable: SceneVariable): OptionsPaneItemDescriptor[] {
  if (!(variable instanceof ConstantVariable)) {
    console.warn('getConstantVariableOptions: variable is not a ConstantVariable');
    return [];
  }

  const valueInputId = `variable-${variable.state.key}-value`;

  return [
    new OptionsPaneItemDescriptor({
      title: t('dashboard-scene.constant-variable-form.label-value', 'Value'),
      id: valueInputId,
      render: () => <ConstantValueInput id={valueInputId} variable={variable} />,
    }),
  ];
}

function ConstantValueInput({ variable, id }: { variable: ConstantVariable; id: string }) {
  const { value } = variable.useState();
  const oldValue = useRef(value);

  const onChange = (event: FormEvent<HTMLInputElement>) => {
    variable.setState({ value: event.currentTarget.value });
  };

  const onBlur = () => {
    const newValue = variable.state.value;
    const previousValue = oldValue.current;

    undoableVariableEdit(previousValue !== newValue, {
      meta: { actionId: 'variable.changeValue', scope: 'constant' },
      source: variable,
      description: t('dashboard.edit-actions.variable-constant-value', 'Change variable value'),
      perform: async () => {
        variable.setState({ value: newValue });
        await lastValueFrom(variable.validateAndUpdate!());
      },
      undo: async () => {
        variable.setState({ value: previousValue });
        await lastValueFrom(variable.validateAndUpdate!());
      },
    });
  };

  return (
    <Input
      key={variable.state.key}
      id={id}
      value={value.toString()}
      onFocus={() => {
        oldValue.current = variable.state.value;
      }}
      onChange={onChange}
      onBlur={onBlur}
      placeholder={t('dashboard-scene.constant-variable-form.placeholder-your-metric-prefix', 'Your metric prefix')}
    />
  );
}
