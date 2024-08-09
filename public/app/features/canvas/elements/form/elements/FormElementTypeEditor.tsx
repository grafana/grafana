import { css } from '@emotion/css';
import { uniqueId } from 'lodash';
import { useCallback } from 'react';
import { useObservable } from 'react-use';
import { Subject } from 'rxjs';

import { GrafanaTheme2, SelectableValue, StandardEditorProps } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';
import { AddLayerButton } from 'app/core/components/Layers/AddLayerButton';
import { OptionsPaneCategory } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategory';
import { APIEditor, APIEditorConfig } from 'app/plugins/panel/canvas/editor/element/APIEditor';

import { defaultApiConfig } from '../../button';
import { FormElementType } from '../form';

import { CheckboxEditor } from './CheckboxEditor';
import { NumberInputEditor } from './NumberInputEditor';
import { RadioListEditor } from './RadioListEditor';
import { SelectionEditor } from './SelectionEditor';
import { TextInputEditor } from './TextInputEditor';
import { updateAPIPayload } from './utils';

export interface FormChild {
  id: string;
  type: string;
  title: string;
  options?: Array<[string, string]>;
  currentOption?: Array<{ [key: string]: string }>;
  api?: APIEditorConfig;
}

type Props = StandardEditorProps<FormChild[]>;

const defaultOptionsConfig = [
  {
    'Option 1': 'option1',
  },
];

export const FormElementTypeEditor = ({ value, context, onChange, item }: Props) => {
  const typeOptions = [
    { value: FormElementType.Checkbox, label: 'Checkbox' },
    { value: FormElementType.Radio, label: 'Radio' },
    { value: FormElementType.Select, label: 'Select' },
    { value: FormElementType.TextInput, label: 'Text input' },
    { value: FormElementType.DateRangePicker, label: 'Date range picker' },
    { value: FormElementType.NumberInput, label: 'Number input' },
    { value: FormElementType.Submit, label: 'Submit' },
  ];

  const scene = context.instanceState?.scene;

  // Will force a rerender whenever the subject changes
  useObservable(scene ? scene.moved : new Subject());

  const styles = useStyles2(getStyles);

  const onChangeElementType = useCallback(
    (sel: SelectableValue<string>) => {
      // allow only one submit button per form
      if (sel.value === 'Submit' && value.some((child) => child.type === 'Submit')) {
        console.warn('Only one submit button allowed per form');
        return;
      }

      // don't allow DateRangePicker yet
      if (sel.value === FormElementType.DateRangePicker) {
        console.warn('DateRangePicker is not supported yet');
        return;
      }

      const id = uniqueId(`form-${sel.value}-element-`);
      let newFormElement: FormChild = { id, type: sel.value ?? '', title: id };
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
          if (sel.value === FormElementType.Checkbox || sel.value === FormElementType.Radio) {
            newFormElement = {
              ...newFormElement,
              options: defaultOptionsConfig.map((option) => Object.entries(option)[0]),
              currentOption: defaultOptionsConfig,
            };
          }

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
      updateAPIPayload(newElements, scene);
    },
    [onChange, value, scene]
  );

  const onTextInputOptionsChange = useCallback(
    (newLabel: string, id: string) => {
      const newElements: FormChild[] = value.map((child) => {
        if (child.id === id) {
          const keys = Object.keys(child?.currentOption![0]);
          return { ...child, title: newLabel, currentOption: [{ [newLabel]: child.currentOption![0][keys[0]] }] };
        }
        return child;
      });
      onChange(newElements);
      updateAPIPayload(newElements, scene);
    },
    [onChange, value, scene]
  );

  const onSelectionItemTitleChange = useCallback(
    (newTitle: string, id: string) => {
      const newElements = value.map((child) => {
        if (child.id === id) {
          return { ...child, title: newTitle };
        }
        return child;
      });

      onChange(newElements);
    },
    [onChange, value]
  );

  const onNumberInputTitleChange = useCallback(
    (newLabel: string, id: string) => {
      const newElements: FormChild[] = value.map((child) => {
        if (child.id === id) {
          const keys = Object.keys(child?.currentOption![0]);
          return { ...child, title: newLabel, currentOption: [{ [newLabel]: child.currentOption![0][keys[0]] }] };
        }
        return child;
      });

      onChange(newElements);
      updateAPIPayload(newElements, scene);
    },
    [onChange, value, scene]
  );

  const onCheckboxParamsChange = useCallback(
    (newParams: Array<[string, string]>, id: string) => {
      const newElements = value.map((child) => {
        if (child.id === id) {
          return {
            ...child,
            options: newParams,
            currentOption: newParams.map((option) => ({ [option[0]]: option[1] })),
          };
        }
        return child;
      });
      onChange(newElements);
      updateAPIPayload(newElements, scene);
    },
    [onChange, value, scene]
  );

  const onCheckBoxTitleChange = useCallback(
    (newTitle: string, id: string) => {
      const newElements = value.map((child) => {
        if (child.id === id) {
          return { ...child, title: newTitle };
        }
        return child;
      });
      onChange(newElements);
    },
    [onChange, value]
  );

  const onRemoveElement = useCallback(
    (id: string) => {
      const newElements = value.filter((child) => child.id !== id);
      onChange(newElements);
      updateAPIPayload(newElements, scene);
    },
    [onChange, value, scene]
  );

  const children = value.map((child, i) => {
    let element;

    switch (child.type) {
      case FormElementType.Select:
        element = (
          <SelectionEditor
            title={child.title}
            options={child.options ?? []}
            onParamsChange={(newParams) => onOptionsChange(newParams, child.id)}
            onTitleChange={(v) => onSelectionItemTitleChange(v, child.id)}
          />
        );
        return {
          element,
          properties: child,
        };

      case FormElementType.TextInput:
        element = (
          <TextInputEditor
            title={child.title}
            onChange={(newValue) => onTextInputOptionsChange(newValue, child.id)}
            currentOption={child.currentOption}
          />
        );
        return {
          element,
          properties: child,
        };
      case FormElementType.NumberInput:
        element = (
          <NumberInputEditor
            title={child.title}
            onChange={(newValue) => onNumberInputTitleChange(newValue, child.id)}
            currentOption={child.currentOption}
          />
        );
        return {
          element,
          properties: child,
        };

      case FormElementType.Checkbox:
        element = (
          <CheckboxEditor
            title={child.title}
            options={child.options ?? []}
            onParamsChange={(v) => onCheckboxParamsChange(v, child.id)}
            onTitleChange={(v) => onCheckBoxTitleChange(v, child.id)}
          />
        );
        return {
          element,
          properties: child,
        };
      case FormElementType.Radio:
        element = (
          <RadioListEditor
            title={child.title}
            options={child.options ?? []}
            onParamsChange={(newParams) => onOptionsChange(newParams, child.id)}
            onTitleChange={(v) => onSelectionItemTitleChange(v, child.id)}
          />
        );
        return {
          element,
          properties: child,
        };
      case FormElementType.Submit:
        element = (
          <APIEditor
            item={item}
            value={value[i].api!}
            context={context}
            onChange={(apiConfig) => onAPIConfigChange(apiConfig!, child.id)}
          />
        );
        return {
          element,
          properties: child,
        };

      default:
        return {
          element: null,
          properties: null,
        };
    }
  });

  return (
    <>
      <AddLayerButton onChange={onChangeElementType} options={typeOptions} label={'Add element type'} />
      <div className={styles.optionsContainer}>
        {children.map((child, i) => (
          <OptionsPaneCategory
            id={i.toString()}
            key={i}
            title={child.properties?.type !== 'Submit' ? child.properties?.title : 'Submit'}
            headerItems={
              <IconButton aria-label="delete" onClick={() => onRemoveElement(child.properties?.id!)} name="trash-alt" />
            }
          >
            {child.element}
          </OptionsPaneCategory>
        ))}
      </div>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  optionsContainer: css({
    marginTop: theme.spacing(1),
  }),
});
