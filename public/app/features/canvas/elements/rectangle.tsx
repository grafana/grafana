import { css } from '@emotion/css';
import { PureComponent } from 'react';

import { GrafanaTheme2, OneClickMode } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';
import { config } from 'app/core/config';
import { DimensionContext } from 'app/features/dimensions/context';
import { ColorDimensionEditor } from 'app/features/dimensions/editors/ColorDimensionEditor';
import { TextDimensionEditor } from 'app/features/dimensions/editors/TextDimensionEditor';

import {
  CanvasElementItem,
  CanvasElementOptions,
  CanvasElementProps,
  defaultBgColor,
  defaultTextColor,
} from '../element';
import { Align, TextConfig, TextData, VAlign } from '../types';

class RectangleDisplay extends PureComponent<CanvasElementProps<TextConfig, TextData>> {
  render() {
    const { data } = this.props;
    const styles = getStyles(config.theme2, data);

    return (
      <div className={styles.container}>
        <span className={styles.span}>{data?.text}</span>
      </div>
    );
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme2, data) => ({
  container: css({
    position: 'absolute',
    height: '100%',
    width: '100%',
    display: 'table',
  }),
  span: css({
    display: 'table-cell',
    verticalAlign: data?.valign,
    textAlign: data?.align,
    fontSize: `${data?.size}px`,
    color: data?.color,
  }),
}));

export const rectangleItem: CanvasElementItem<TextConfig, TextData> = {
  id: 'rectangle',
  name: 'Rectangle',
  description: 'Rectangle',

  display: RectangleDisplay,

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
    },
    background: {
      color: {
        fixed: defaultBgColor,
      },
    },
    oneClickMode: options?.oneClickMode ?? OneClickMode.Off,
    links: options?.links ?? [],
  }),

  // Called when data changes
  prepareData: (dimensionContext: DimensionContext, elementOptions: CanvasElementOptions<TextConfig>) => {
    const textConfig = elementOptions.config;

    const data: TextData = {
      text: textConfig?.text ? dimensionContext.getText(textConfig.text).value() : '',
      field: textConfig?.text?.field,
      align: textConfig?.align ?? Align.Center,
      valign: textConfig?.valign ?? VAlign.Middle,
      size: textConfig?.size,
    };

    if (textConfig?.color) {
      data.color = dimensionContext.getColor(textConfig.color).value();
    }

    return data;
  },

  // Heatmap overlay options
  registerOptionsUI: (builder) => {
    const category = ['Rectangle'];
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
