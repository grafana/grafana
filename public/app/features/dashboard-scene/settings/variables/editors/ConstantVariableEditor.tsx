import { FormEvent } from 'react';
import { lastValueFrom } from 'rxjs';

import { ConstantVariable, SceneVariable } from '@grafana/scenes';
import { Input } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

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

  return [
    new OptionsPaneItemDescriptor({
      title: t('dashboard-scene.constant-variable-form.label-value', 'Value'),
      render: () => <ConstantValueInput variable={variable} />,
    }),
  ];
}

function ConstantValueInput({ variable }: { variable: ConstantVariable }) {
  const { value } = variable.useState();

  const onBlur = async (event: FormEvent<HTMLInputElement>) => {
    variable.setState({ value: event.currentTarget.value });
    await lastValueFrom(variable.validateAndUpdate!());
  };

  return (
    <Input
      defaultValue={value.toString()}
      onBlur={onBlur}
      placeholder={t('dashboard-scene.constant-variable-form.placeholder-your-metric-prefix', 'Your metric prefix')}
    />
  );
}
