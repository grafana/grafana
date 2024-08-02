import { css } from '@emotion/css';
import { useObservable } from 'react-use';

import { GrafanaTheme2, OneClickMode } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { DimensionContext } from 'app/features/dimensions/context';
import { ColorDimensionEditor } from 'app/features/dimensions/editors/ColorDimensionEditor';
import { TextDimensionEditor } from 'app/features/dimensions/editors/TextDimensionEditor';
import { activePanelSubject } from 'app/plugins/panel/canvas/CanvasPanel';

import { CanvasElementItem, CanvasElementOptions, CanvasElementProps, defaultThemeTextColor } from '../../element';
import { FrameState } from '../../runtime/frame';
import { Align, TextConfig, TextData, VAlign } from '../../types';

import { FormElementTypeEditor } from './elements/FormElementTypeEditor';

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

interface FormData extends TextData {
  type: FormElementType;
}

export interface FormConfig extends TextConfig {
  type: FormElementType;
}

const Form = (props: CanvasElementProps<FormConfig, FormData>) => {
  const { data, config } = props;
  const styles = useStyles2(getStyles(data));

  //   const instanceState = activePanel?.panel.context?.instanceState;

  //   console.log('instanceState', instanceState);

  //   const rootLayer: FrameState | undefined = instanceState?.layer;

  console.log({ data, config });

  return (
    <div className={styles.container}>
      <h3>Form</h3>
    </div>
  );
};

const getStyles = (data: FormData | undefined) => (theme: GrafanaTheme2) => ({
  container: css({
    height: '100%',
    width: '100%',
    display: 'flex',
    border: `1px solid ${theme.colors.border.strong}`,
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
    verticalAlign: data?.valign,
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
      valign: VAlign.Middle,
      color: {
        fixed: defaultThemeTextColor,
      },
      size: 16,
      type: FormElementType.TextInput,
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
      valign: formConfig?.valign ?? VAlign.Middle,
      size: formConfig?.size,
      type: formConfig?.type ?? FormElementType.TextInput,
    };

    if (formConfig?.color) {
      data.color = dimensionContext.getColor(formConfig.color).value();
    }

    return data;
  },

  registerOptionsUI: (builder) => {
    const category = ['Form'];
    builder
      //   .addSelect({
      //     category,
      //     path: 'config.type',
      //     name: 'Element type',
      //     settings: {
      //       options: [
      //         { value: FormElementType.Checkbox, label: 'Checkbox' },
      //         { value: FormElementType.Radio, label: 'Radio' },
      //         { value: FormElementType.Select, label: 'Select' },
      //         { value: FormElementType.TextInput, label: 'Text input' },
      //         { value: FormElementType.DateRangePicker, label: 'Date range picker' },
      //       ],
      //     },
      //     defaultValue: FormElementType.TextInput,
      //   })
      .addCustomEditor({
        category,
        id: 'formElementEditor',
        path: 'config.type',
        name: 'Type',
        editor: FormElementTypeEditor,
        settings: { blah: 'blah' },
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
        defaultValue: Align.Left,
      })
      .addRadio({
        category,
        path: 'config.valign',
        name: 'Vertical align',
        settings: {
          options: [
            { value: VAlign.Top, label: 'Top' },
            { value: VAlign.Middle, label: 'Middle' },
            { value: VAlign.Bottom, label: 'Bottom' },
          ],
        },
        defaultValue: VAlign.Middle,
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
