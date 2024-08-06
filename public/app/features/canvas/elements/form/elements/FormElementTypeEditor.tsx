import { uniqueId } from 'lodash';
import { useCallback } from 'react';

import { SelectableValue, StandardEditorProps } from '@grafana/data';
import { AddLayerButton } from 'app/core/components/Layers/AddLayerButton';

import { FormElementType } from '../form';

import { SelectionEditor } from './SelectionEditor';

export interface FormChild {
  id: string;
  type: string;
  options?: Array<[string, string]>;
  currentOption?: [string, string];
}

type Props = StandardEditorProps<FormChild[]>;

export const FormElementTypeEditor = ({ value, context, onChange, item }: Props) => {
  const typeOptions = [
    { value: FormElementType.Checkbox, label: 'Checkbox' },
    { value: FormElementType.Radio, label: 'Radio' },
    { value: FormElementType.Select, label: 'Select' },
    { value: FormElementType.TextInput, label: 'Text input' },
    { value: FormElementType.DateRangePicker, label: 'Date range picker' },
    { value: 'Submit', label: 'Submit' },
  ];

  const onChangeElementType = useCallback(
    (sel: SelectableValue<string>) => {
      const id = uniqueId('form-element-');
      onChange([...value, { id, type: sel.value ?? '' }]);
    },
    [onChange, value]
  );

  // onOptionsChange
  const onOptionsChange = useCallback(
    (newParams: Array<[string, string]>, id: string) => {
      // find the element with the id and update the options
      const newElements = value.map((child) => {
        if (child.id === id) {
          return { ...child, options: newParams };
        }
        return child;
      });
      onChange(newElements);
    },
    [onChange, value]
  );

  const children = value.map((child) => {
    switch (child.type) {
      case 'Select':
        return (
          <SelectionEditor
            options={child.options ?? []}
            onChange={(newParams) => onOptionsChange(newParams, child.id)}
          />
        );
      case 'Submit':
        return <button>TODO Submit Editor</button>;
      default:
        return null;
    }
  });

  return (
    <>
      <AddLayerButton onChange={onChangeElementType} options={typeOptions} label={'Add element type'} />
      {children}
    </>
  );
};
