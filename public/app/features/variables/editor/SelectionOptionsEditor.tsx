import React, { ChangeEvent, FormEvent, useCallback } from 'react';

import { SelectionOptionsForm } from 'app/features/dashboard-scene/settings/variables/components/SelectionOptionsForm';

import { KeyedVariableIdentifier } from '../state/types';
import { VariableWithMultiSupport } from '../types';
import { toKeyedVariableIdentifier } from '../utils';

import { VariableEditorProps } from './types';

export interface SelectionOptionsEditorProps<Model extends VariableWithMultiSupport = VariableWithMultiSupport>
  extends VariableEditorProps<Model> {
  onMultiChanged: (identifier: KeyedVariableIdentifier, value: boolean) => void;
}

export const SelectionOptionsEditor = ({
  onMultiChanged: onMultiChangedProps,
  onPropChange,
  variable,
}: SelectionOptionsEditorProps) => {
  const onMultiChanged = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onMultiChangedProps(toKeyedVariableIdentifier(variable), event.target.checked);
    },
    [onMultiChangedProps, variable]
  );

  const onIncludeAllChanged = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onPropChange({ propName: 'includeAll', propValue: event.target.checked });
    },
    [onPropChange]
  );

  const onAllValueChanged = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      onPropChange({ propName: 'allValue', propValue: event.currentTarget.value });
    },
    [onPropChange]
  );

  return (
    <SelectionOptionsForm
      multi={variable.multi}
      includeAll={variable.includeAll}
      allValue={variable.allValue}
      onMultiChange={onMultiChanged}
      onIncludeAllChange={onIncludeAllChanged}
      onAllValueChange={onAllValueChanged}
    />
  );
};
SelectionOptionsEditor.displayName = 'SelectionOptionsEditor';
