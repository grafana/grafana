import { css } from '@emotion/css';
import { cond } from 'lodash';
import { useCallback } from 'react';

import { GrafanaTheme2, OneClickMode } from '@grafana/data';
import { usePanelContext, useStyles2 } from '@grafana/ui';
import { conf } from 'app/features/alerting/unified/components/receivers/editor/language';
import { DimensionContext } from 'app/features/dimensions/context';
import { ColorDimensionEditor } from 'app/features/dimensions/editors/ColorDimensionEditor';
import { TextDimensionEditor } from 'app/features/dimensions/editors/TextDimensionEditor';

import { CanvasElementItem, CanvasElementOptions, CanvasElementProps, defaultThemeTextColor } from '../../element';
import { Align, TextConfig, TextData } from '../../types';

import { FormChild, FormElementTypeEditor } from './elements/FormElementTypeEditor';
import { SelectDisplay } from './elements/Select';
import { Submit } from './elements/Submit';

/**
 * Form Element - each of these would have options
 * checkbox
 * radio
 * select
 * search
 * table - will come from viz element
 * button
 */

export enum FormElementType {
  Checkbox = 'Checkbox',
  Radio = 'Radio',
  Select = 'Select',
  TextInput = 'TextInput',
  DateRangePicker = 'DateRangePicker',
  // table
}

interface FormData extends Omit<TextData, 'valign'> {
  formElements?: FormChild[];
}

export interface FormConfig extends Omit<TextConfig, 'valign'> {
  formElements?: FormChild[];
}

const Form = (props: CanvasElementProps<FormConfig, FormData>) => {
  const { data, config } = props;
  const styles = useStyles2(getStyles(data));

  const context = usePanelContext();
  const scene = context.instanceState?.scene;

  console.log(scene);

  console.log({ data, config });

  const onCurrentOptionChange = (newParams: [string, string], id: string) => {
    // find child with id and update the currentOption
    const child = config.formElements?.find((child) => child.id === id);

    if (child) {
      child.currentOption = newParams;
    }

    updateAPIPayload();
    // TODO: figure out why this is not updating the editor
    // it's updating the save model but
    // see layoutEditor
    scene.moved.next(Date.now());
  };

  const updateAPIPayload = () => {
    const submitElement = config.formElements?.find((child) => {
      if (child.type === 'Submit') {
        return true;
      }
      return false;
    });

    if (!submitElement) {
      return;
    }

    const payload = config.formElements?.reduce<Record<string, any>>((acc, child) => {
      if (child.type !== 'Submit' && child.currentOption) {
        // Ensure currentOption is an array with at least two elements
        const [key, value] = child.currentOption;
        if (typeof key === 'string') {
          acc[key] = value;
        }
      }
      return acc;
    }, {});

    submitElement.api!.data = JSON.stringify(payload);
  };

  const children = config.formElements?.map((child) => {
    switch (child.type) {
      case 'Select':
        return (
          <SelectDisplay
            options={child.options ?? []}
            currentOption={child.currentOption}
            onChange={(newParams) => onCurrentOptionChange(newParams, child.id)}
          />
        );
      case 'Submit':
        return <Submit formItem={child} />;
      default:
        return null;
    }
  });

  return (
    <div className={styles.container}>
      <span className={styles.span}>{data?.text}</span>
      <div className={styles.itemsContainer}>{children?.map((child, i) => <div key={i}>{child}</div>)}</div>
    </div>
  );
};

const getStyles = (data: FormData | undefined) => (theme: GrafanaTheme2) => ({
  container: css({
    height: '100%',
    width: '100%',
    display: 'flex',
    border: `1px solid ${theme.colors.border.strong}`,
    flexDirection: 'column',
  }),
  itemsContainer: css({
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(1),
    gap: theme.spacing(1),
  }),
  inlineEditorContainer: css({
    height: '100%',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(1),
  }),
  span: css({
    display: 'table-cell',
    textAlign: data?.align,
    fontSize: `${data?.size}px`,
    color: data?.color,
  }),
});

export const formItem: CanvasElementItem<FormConfig, FormData> = {
  id: 'form',
  name: 'Form',
  description: 'Form element',

  display: Form,

  hasEditMode: true,

  defaultSize: {
    width: 100,
    height: 50,
  },

  getNewOptions: (options) => ({
    ...options,
    config: {
      align: Align.Center,
      color: {
        fixed: defaultThemeTextColor,
      },
      size: 16,
      formElements: options?.config.formElements ?? [],
    },
    placement: {
      width: options?.placement?.width ?? 100,
      height: options?.placement?.height ?? 100,
      top: options?.placement?.top,
      left: options?.placement?.left,
      rotation: options?.placement?.rotation ?? 0,
    },
    oneClickMode: options?.oneClickMode ?? OneClickMode.Off,
    links: options?.links ?? [],
  }),

  prepareData: (dimensionContext: DimensionContext, elementOptions: CanvasElementOptions<FormConfig>) => {
    const formConfig = elementOptions.config;

    const data: FormData = {
      text: formConfig?.text ? dimensionContext.getText(formConfig.text).value() : '',
      field: formConfig?.text?.field,
      align: formConfig?.align ?? Align.Center,
      size: formConfig?.size,
      formElements: formConfig?.formElements,
    };

    if (formConfig?.color) {
      data.color = dimensionContext.getColor(formConfig.color).value();
    }

    return data;
  },

  registerOptionsUI: (builder) => {
    const category = ['Form'];
    builder
      .addCustomEditor({
        category,
        id: 'formElementEditor',
        path: 'config.formElements',
        name: 'Form elements',
        editor: FormElementTypeEditor,
      })
      .addCustomEditor({
        category,
        id: 'textSelector',
        path: 'config.text',
        name: 'Text',
        editor: TextDimensionEditor,
      })
      .addCustomEditor({
        category,
        id: 'config.color',
        path: 'config.color',
        name: 'Text color',
        editor: ColorDimensionEditor,
        settings: {},
        defaultValue: {},
      })
      .addRadio({
        category,
        path: 'config.align',
        name: 'Align text',
        settings: {
          options: [
            { value: Align.Left, label: 'Left' },
            { value: Align.Center, label: 'Center' },
            { value: Align.Right, label: 'Right' },
          ],
        },
        defaultValue: Align.Center,
      })
      .addNumberInput({
        category,
        path: 'config.size',
        name: 'Text size',
        settings: {
          placeholder: 'Auto',
        },
      });
  },
};
