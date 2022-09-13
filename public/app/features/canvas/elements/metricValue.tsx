import { css } from '@emotion/css';
import React from 'react';

import { DataFrame, FieldNamePickerConfigSettings, GrafanaTheme2, StandardEditorsRegistryItem } from '@grafana/data';
import { usePanelContext, useStyles2 } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';
import { TextDimensionMode } from 'app/features/dimensions';
import { DimensionContext } from 'app/features/dimensions/context';
import { ColorDimensionEditor } from 'app/features/dimensions/editors/ColorDimensionEditor';
import { TextDimensionEditor } from 'app/features/dimensions/editors/TextDimensionEditor';

import { CanvasElementItem, CanvasElementProps, defaultBgColor, defaultTextColor } from '../element';

import { Align, TextBoxConfig, TextBoxData, VAlign } from './textBox';

const dummyFieldSettings: StandardEditorsRegistryItem<string, FieldNamePickerConfigSettings> = {
  settings: {},
} as any;

const MetricValueDisplay = (props: CanvasElementProps<TextBoxConfig, TextBoxData>) => {
  const styles = useStyles2(getStyles(props.data));

  if (!props?.data?.text) {
    return <MetricValueInlineEdit {...props} />;
  }
  return (
    <div className={styles.container}>
      <span className={styles.span}>{props.data?.text}</span>
    </div>
  );
};

const MetricValueInlineEdit = (props: CanvasElementProps<TextBoxConfig, TextBoxData>) => {
  const context = usePanelContext();
  const data = context.instanceState?.scene?.data.series as DataFrame[];
  const styles = useStyles2(getStyles(props.data));
  return (
    <div className={styles.container}>
      <FieldNamePicker
        context={{ data }}
        value={''}
        onChange={(foo: any) => console.log(foo)}
        item={dummyFieldSettings}
      />
    </div>
  );
};

const getStyles = (data: TextBoxData | undefined) => (theme: GrafanaTheme2) => ({
  container: css`
    position: absolute;
    height: 100%;
    width: 100%;
    display: table;
  `,
  span: css`
    display: table-cell;
    vertical-align: ${data?.valign};
    text-align: ${data?.align};
    font-size: ${data?.size}px;
    color: ${data?.color};
  `,
});

export const metricValueItem: CanvasElementItem<TextBoxConfig, TextBoxData> = {
  id: 'metric-value',
  name: 'Metric Value',
  description: 'Display a field value',

  display: MetricValueDisplay,

  defaultSize: {
    width: 240,
    height: 160,
  },

  getNewOptions: (options) => ({
    ...options,
    config: {
      align: Align.Center,
      valign: VAlign.Middle,
      color: {
        fixed: defaultTextColor,
      },
      text: { mode: TextDimensionMode.Field, fixed: '', field: '' },
      size: 24,
    },
    background: {
      color: {
        fixed: defaultBgColor,
      },
    },
  }),

  prepareData: (ctx: DimensionContext, cfg: TextBoxConfig) => {
    const data: TextBoxData = {
      text: cfg.text ? ctx.getText(cfg.text).value() : '',
      align: cfg.align ?? Align.Center,
      valign: cfg.valign ?? VAlign.Middle,
      size: cfg.size,
    };

    if (cfg.color) {
      data.color = ctx.getColor(cfg.color).value();
    }

    return data;
  },

  registerOptionsUI: (builder) => {
    const category = ['Metric value'];
    builder
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
