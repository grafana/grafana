import { FormEvent, memo } from 'react';

import { ConstantVariableModel } from '@grafana/data';
import { ConstantVariableForm } from 'app/features/dashboard-scene/settings/variables/components/ConstantVariableForm';

import { VariableEditorProps } from '../editor/types';

export interface Props extends VariableEditorProps<ConstantVariableModel> {}

export const ConstantVariableEditor = memo(({ variable, onPropChange }: Props) => {
  const onChange = (event: FormEvent<HTMLInputElement>) => {
    onPropChange({
      propName: 'query',
      propValue: event.currentTarget.value,
      updateOptions: true,
    });
  };

  return <ConstantVariableForm constantValue={variable.query} onChange={onChange} />;
});
ConstantVariableEditor.displayName = 'ConstantVariableEditor';
