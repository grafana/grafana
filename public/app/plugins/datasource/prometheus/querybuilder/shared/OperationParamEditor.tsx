import { toOption } from '@grafana/data';
import { Input, Select } from '@grafana/ui';
import React, { ComponentType } from 'react';
import { QueryBuilderOperationParamDef, QueryBuilderOperationParamEditorProps } from '../shared/types';
import { getOperationParamId } from './operationUtils';

export function getOperationParamEditor(
  paramDef: QueryBuilderOperationParamDef
): ComponentType<QueryBuilderOperationParamEditorProps> {
  if (paramDef.editor) {
    return paramDef.editor;
  }

  if (paramDef.options) {
    return SelectInputParamEditor;
  }

  return SimpleInputParamEditor;
}

function SimpleInputParamEditor(props: QueryBuilderOperationParamEditorProps) {
  return (
    <Input
      id={getOperationParamId(props.operationIndex, props.index)}
      defaultValue={props.value ?? ''}
      onKeyDown={(evt) => {
        if (evt.key === 'Enter') {
          if (evt.currentTarget.value !== props.value) {
            props.onChange(props.index, evt.currentTarget.value);
          }
          props.onRunQuery();
        }
      }}
      onBlur={(evt) => {
        props.onChange(props.index, evt.currentTarget.value);
      }}
    />
  );
}

function SelectInputParamEditor({
  paramDef,
  value,
  index,
  operationIndex,
  onChange,
}: QueryBuilderOperationParamEditorProps) {
  const selectOptions = paramDef.options!.map((option) => ({
    label: option as string,
    value: option as string,
  }));

  return (
    <Select
      id={getOperationParamId(operationIndex, index)}
      menuShouldPortal
      value={toOption(value as string)}
      options={selectOptions}
      onChange={(value) => onChange(index, value.value!)}
    />
  );
}
