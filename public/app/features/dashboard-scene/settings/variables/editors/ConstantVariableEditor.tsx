import { type FormEvent } from 'react';
import { lastValueFrom } from 'rxjs';

import { t } from '@grafana/i18n';
import { ConstantVariable, type SceneVariable } from '@grafana/scenes';
import { Input } from '@grafana/ui';
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

  const onChange = (event: FormEvent<HTMLInputElement>) => {
    variable.setState({ value: event.currentTarget.value });
  };

  const onBlur = async () => {
    await lastValueFrom(variable.validateAndUpdate!());
  };

  return (
    <Input
      key={variable.state.key}
      id={id}
      value={value.toString()}
      onChange={onChange}
      onBlur={onBlur}
      placeholder={t('dashboard-scene.constant-variable-form.placeholder-your-metric-prefix', 'Your metric prefix')}
    />
  );
}
