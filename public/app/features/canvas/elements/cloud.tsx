import { css } from '@emotion/css';
import { v4 as uuidv4 } from 'uuid';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from 'app/core/config';
import { DimensionContext } from 'app/features/dimensions/context';
import { ColorDimensionEditor } from 'app/features/dimensions/editors/ColorDimensionEditor';
import { TextDimensionEditor } from 'app/features/dimensions/editors/TextDimensionEditor';

import {
  CanvasElementItem,
  CanvasElementProps,
  CanvasElementOptions,
  defaultBgColor,
  defaultTextColor,
} from '../element';
import { Align, CanvasElementConfig, CanvasElementData, VAlign } from '../types';

const Cloud = (props: CanvasElementProps<CanvasElementConfig, CanvasElementData>) => {
  const { data } = props;
  const styles = getStyles(config.theme2, data);

  // uuid needed to avoid id conflicts when multiple elements are rendered
  const uniqueId = uuidv4();

  return (
    <div className={styles.container}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 110 70"
        width="100%"
        height="100%"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern id={`image-${uniqueId}`} patternUnits="userSpaceOnUse" width="110" height="70">
            <image xlinkHref={data?.backgroundImage} x="-50" y="-50" width="300" height="300"></image>
          </pattern>
          <clipPath id={`cloudClip-${uniqueId}`}>
            <path d="M 23 13 C -1 13 -7 33 12.2 37 C -7 45.8 14.6 65 30.2 57 C 41 73 77 73 89 57 C 113 57 113 41 98 33 C 113 17 89 1 68 9 C 53 -3 29 -3 23 13 Z" />
          </clipPath>
        </defs>
        {/* Apply background image within the clipping area */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          clipPath={`url(#cloudClip-${uniqueId})`}
          style={{ fill: 'none' }}
        />
        <path
          d="M 23 13 C -1 13 -7 33 12.2 37 C -7 45.8 14.6 65 30.2 57 C 41 73 77 73 89 57 C 113 57 113 41 98 33 C 113 17 89 1 68 9 C 53 -3 29 -3 23 13 Z"
          style={{ fill: data?.backgroundImage ? `url(#image-${uniqueId})` : data?.backgroundColor }}
        />

        {/* Border */}
        <path
          d="M 23 13 C -1 13 -7 33 12.2 37 C -7 45.8 14.6 65 30.2 57 C 41 73 77 73 89 57 C 113 57 113 41 98 33 C 113 17 89 1 68 9 C 53 -3 29 -3 23 13 Z"
          clipPath={`url(#cloudClip-${uniqueId})`}
          className={styles.elementBorder}
        />
      </svg>
      <span className={styles.text}>{data?.text}</span>
    </div>
  );
};

export const cloudItem: CanvasElementItem = {
  id: 'cloud',
  name: 'Cloud',
  description: 'Cloud',

  display: Cloud,

  defaultSize: {
    width: 110,
    height: 70,
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
      width: options?.placement?.width ?? 110,
      height: options?.placement?.height ?? 70,
      top: options?.placement?.top,
      left: options?.placement?.left,
      rotation: options?.placement?.rotation ?? 0,
    },
    links: options?.links ?? [],
  }),

  // Called when data changes
  prepareData: (dimensionContext: DimensionContext, elementOptions: CanvasElementOptions<CanvasElementConfig>) => {
    const textConfig = elementOptions.config;

    const data: CanvasElementData = {
      text: textConfig?.text ? dimensionContext.getText(textConfig.text).value() : '',
      field: textConfig?.text?.field,
      align: textConfig?.align ?? Align.Center,
      valign: textConfig?.valign ?? VAlign.Middle,
      size: textConfig?.size,
    };

    if (textConfig?.color) {
      data.color = dimensionContext.getColor(textConfig.color).value();
    }

    const { background, border } = elementOptions;
    data.backgroundColor = background?.color ? dimensionContext.getColor(background.color).value() : defaultBgColor;
    data.borderColor = border?.color ? dimensionContext.getColor(border.color).value() : defaultBgColor;
    data.borderWidth = border?.width ?? 0;

    data.backgroundImage = background?.image ? dimensionContext.getResource(background.image).value() : undefined;

    return data;
  },

  registerOptionsUI: (builder) => {
    const category = [t('canvas.cloud-item.category-cloud', 'Cloud')];
    builder
      .addCustomEditor({
        category,
        id: 'textSelector',
        path: 'config.text',
        name: t('canvas.cloud-item.name-text', 'Text'),
        editor: TextDimensionEditor,
      })
      .addCustomEditor({
        category,
        id: 'config.color',
        path: 'config.color',
        name: t('canvas.cloud-item.name-text-color', 'Text color'),
        editor: ColorDimensionEditor,
        settings: {},
        defaultValue: {},
      })
      .addRadio({
        category,
        path: 'config.align',
        name: t('canvas.cloud-item.name-align-text', 'Align text'),
        settings: {
          options: [
            { value: Align.Left, label: t('canvas.cloud-item.label.left', 'Left') },
            { value: Align.Center, label: t('canvas.cloud-item.label.center', 'Center') },
            { value: Align.Right, label: t('canvas.cloud-item.label.right', 'Right') },
          ],
        },
        defaultValue: Align.Left,
      })
      .addRadio({
        category,
        path: 'config.valign',
        name: t('canvas.cloud-item.name-vertical-align', 'Vertical align'),
        settings: {
          options: [
            { value: VAlign.Top, label: t('canvas.cloud-item.label.top', 'Top') },
            { value: VAlign.Middle, label: t('canvas.cloud-item.label.middle', 'Middle') },
            { value: VAlign.Bottom, label: t('canvas.cloud-item.label.bottom', 'Bottom') },
          ],
        },
        defaultValue: VAlign.Middle,
      })
      .addNumberInput({
        category,
        path: 'config.size',
        name: t('canvas.cloud-item.name-text-size', 'Text size'),
        settings: {
          placeholder: t('canvas.cloud-item.placeholder.auto', 'Auto'),
        },
      });
  },

  customConnectionAnchors: [
    { x: -0.58, y: 0.63 }, // Top Left
    { x: -0.22, y: 0.99 }, // Top Middle
    { x: 0.235, y: 0.75 }, // Top Right

    { x: 0.8, y: 0.6 }, // Right Top
    { x: 0.785, y: 0.06 }, // Right Middle
    { x: 0.91, y: -0.51 }, // Right Bottom

    { x: 0.62, y: -0.635 }, // Bottom Right
    { x: 0.05, y: -0.98 }, // Bottom Middle
    { x: -0.45, y: -0.635 }, // Bottom Left

    { x: -0.8, y: -0.58 }, // Left Bottom
    { x: -0.78, y: -0.06 }, // Left Middle
    { x: -0.9, y: 0.48 }, // Left Top
  ],
};

const getStyles = (theme: GrafanaTheme2, data: CanvasElementData | undefined) => {
  const textTop = data?.valign === VAlign.Middle ? '50%' : data?.valign === VAlign.Top ? '10%' : '90%';
  const textLeft = data?.align === Align.Center ? '50%' : data?.align === Align.Left ? '10%' : '90%';
  const textTransform = `translate(${data?.align === Align.Center ? '-50%' : data?.align === Align.Left ? '10%' : '-90%'}, ${
    data?.valign === VAlign.Middle ? '-50%' : data?.valign === VAlign.Top ? '10%' : '-90%'
  })`;

  return {
    container: css({
      height: '100%',
      width: '100%',
    }),
    text: css({
      position: 'absolute',
      top: textTop,
      left: textLeft,
      transform: textTransform,
      fontSize: `${data?.size}px`,
      color: data?.color,
    }),
    elementBorder: css({
      fill: 'none',
      stroke: data?.borderColor ?? 'none',
      strokeWidth: data?.borderWidth ?? 0,
      strokeLinejoin: 'round',
    }),
  };
};
