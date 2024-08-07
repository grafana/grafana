import { uniqueId } from 'lodash';
import { Fragment, useCallback } from 'react';

import { SelectableValue, StandardEditorProps } from '@grafana/data';
import { AddLayerButton } from 'app/core/components/Layers/AddLayerButton';
import { APIEditor, APIEditorConfig } from 'app/plugins/panel/canvas/editor/element/APIEditor';

import { defaultApiConfig } from '../../button';
import { FormElementType } from '../form';

import { SelectionEditor } from './SelectionEditor';

export interface FormChild {
  id: string;
  type: string;
  options?: Array<[string, string]>;
  currentOption?: [string, string];
  api?: APIEditorConfig;
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
      // allow only one submit button per form
      if (sel.value === 'Submit' && value.some((child) => child.type === 'Submit')) {
        console.warn('Only one submit button allowed per form');
        return;
      }

      const id = uniqueId('form-element-');
      let newFormElement: FormChild = { id, type: sel.value ?? '' };
      if (sel.value === 'Submit') {
        newFormElement = { ...newFormElement, api: defaultApiConfig };
        onChange([...value, newFormElement]);
      } else {
        // insert newFormElement just before the submit button
        const submitIndex = value.findIndex((child) => child.type === 'Submit');
        if (submitIndex === -1) {
          onChange([...value, newFormElement]);
        } else {
          const newElements = [...value];
          newElements.splice(submitIndex, 0, newFormElement);
          onChange(newElements);
        }
      }
    },
    [onChange, value]
  );

  const onOptionsChange = useCallback(
    (newParams: Array<[string, string]>, id: string) => {
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

  const onAPIConfigChange = useCallback(
    (newApiConfig: APIEditorConfig, id: string) => {
      const newElements = value.map((child) => {
        if (child.id === id) {
          return { ...child, api: newApiConfig };
        }
        return child;
      });
      onChange(newElements);
    },
    [onChange, value]
  );

  const children = value.map((child, i) => {
    switch (child.type) {
      case 'Select':
        return (
          <SelectionEditor
            options={child.options ?? []}
            onChange={(newParams) => onOptionsChange(newParams, child.id)}
          />
        );
      case 'Submit':
        return (
          <APIEditor
            item={item}
            value={value[i].api!}
            context={context}
            onChange={(apiConfig) => onAPIConfigChange(apiConfig!, child.id)}
          />
        );
      default:
        return null;
    }
  });

  return (
    <>
      <AddLayerButton onChange={onChangeElementType} options={typeOptions} label={'Add element type'} />
      {children.map((child, i) => (
        <Fragment key={i}>{child}</Fragment>
      ))}
    </>
  );
};
