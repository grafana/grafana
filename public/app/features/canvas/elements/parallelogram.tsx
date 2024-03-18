import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from 'app/core/config';
import { DimensionContext } from 'app/features/dimensions';
import { ColorDimensionEditor } from 'app/features/dimensions/editors/ColorDimensionEditor';
import { TextDimensionEditor } from 'app/features/dimensions/editors/TextDimensionEditor';
import { getDataLinks } from 'app/plugins/panel/canvas/utils';

import {
  CanvasElementItem,
  CanvasElementProps,
  CanvasElementOptions,
  defaultBgColor,
  defaultTextColor,
} from '../element';
import { Align, CanvasElementConfig, CanvasElementData, VAlign } from '../types';

const Parallelogram = (props: CanvasElementProps<CanvasElementConfig, CanvasElementData>) => {
  const { data } = props;
  const styles = getStyles(config.theme2, data);

  return (
    <div className={styles.container}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
        viewBox="0 0 120 60"
        width="100%"
        height="100%"
        className={styles.element}
        preserveAspectRatio="none"
      >
        <path d="M 0 60 L 20 0 L 120 0 L 100 60 Z" />
      </svg>
      <span className={styles.text}>{data?.text}</span>
    </div>
  );
};

export const parallelogramItem: CanvasElementItem = {
  id: 'parallelogram',
  name: 'Parallelogram',
  description: 'Parallelogram',

  display: Parallelogram,

  defaultSize: {
    width: 120,
    height: 60,
  },

  getNewOptions: (options) => ({
    ...options,
    background: {
      color: {
        fixed: defaultBgColor,
      },
    },
    config: {
      align: Align.Center,
      valign: VAlign.Middle,
      color: {
        fixed: defaultTextColor,
      },
    },
    placement: {
      width: options?.placement?.width ?? 120,
      height: options?.placement?.height ?? 60,
      top: options?.placement?.top,
      left: options?.placement?.left,
    },
  }),

  // Called when data changes
  prepareData: (dimensionContext: DimensionContext, elementOptions: CanvasElementOptions<CanvasElementConfig>) => {
    const textConfig = elementOptions.config;

    const data: CanvasElementData = {
      text: textConfig?.text ? dimensionContext.getText(textConfig.text).value() : '',
      align: textConfig?.align ?? Align.Center,
      valign: textConfig?.valign ?? VAlign.Middle,
      size: textConfig?.size,
    };

    if (textConfig?.color) {
      data.color = dimensionContext.getColor(textConfig.color).value();
    }

    data.links = getDataLinks(dimensionContext, elementOptions, data.text);

    const { background, border } = elementOptions;
    data.backgroundColor = background?.color ? dimensionContext.getColor(background.color).value() : defaultBgColor;
    data.borderColor = border?.color ? dimensionContext.getColor(border.color).value() : defaultBgColor;
    data.borderWidth = border?.width ?? 0;

    return data;
  },

  registerOptionsUI: (builder) => {
    const category = ['Parallelogram'];
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

const getStyles = (theme: GrafanaTheme2, data: CanvasElementData | undefined) => ({
  container: css({
    height: '100%',
    width: '100%',
  }),
  text: css({
    position: 'absolute',
    top: data?.valign === VAlign.Middle ? '50%' : data?.valign === VAlign.Top ? '10%' : '90%',
    left: data?.align === Align.Center ? '50%' : data?.align === Align.Left ? '10%' : '90%',
    transform: `translate(${data?.align === Align.Center ? '-50%' : data?.align === Align.Left ? '10%' : '-90%'}, ${data?.valign === VAlign.Middle ? '-50%' : data?.valign === VAlign.Top ? '10%' : '-90%'})`,
    fontSize: `${data?.size}px`,
    color: data?.color,
  }),
  element: css({
    stroke: data?.borderColor,
    strokeWidth: data?.borderWidth,
    fill: data?.backgroundColor,
  }),
});
