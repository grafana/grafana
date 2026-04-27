import { type FormEvent, memo } from 'react';

import type { ConstantVariableModel } from '@grafana/data/types';
import { ConstantVariableForm } from 'app/features/dashboard-scene/settings/variables/components/ConstantVariableForm';

import { type VariableEditorProps } from '../editor/types';

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
