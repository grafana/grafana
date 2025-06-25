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
  CanvasElementOptions,
  CanvasElementProps,
  defaultBgColor,
  defaultTextColor,
} from '../element';
import { Align, CanvasElementConfig, CanvasElementData, VAlign } from '../types';

const Ellipse = (props: CanvasElementProps<CanvasElementConfig, CanvasElementData>) => {
  const { data } = props;
  const styles = getStyles(config.theme2, data);

  // uuid needed to avoid id conflicts when multiple elements are rendered
  const uniqueId = uuidv4();

  return (
    <div className={styles.container}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 200 200"
        width="100%"
        height="100%"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern id={`image-${uniqueId}`} patternUnits="userSpaceOnUse" width="200" height="200">
            <image xlinkHref={data?.backgroundImage} x="-50" y="-50" width="300" height="300"></image>
          </pattern>
          <clipPath id={`ellipseClip-${uniqueId}`}>
            <ellipse cx="50%" cy="50%" rx="50%" ry="50%" />
          </clipPath>
        </defs>
        {/* Apply background image within the clipping area */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          clipPath={`url(#ellipseClip-${uniqueId})`}
          style={{ fill: 'none' }}
        />
        <ellipse
          cx="50%"
          cy="50%"
          rx="50%"
          ry="50%"
          style={{ fill: data?.backgroundImage ? `url(#image-${uniqueId})` : data?.backgroundColor }}
        />

        {/* Border */}
        <ellipse
          cx="50%"
          cy="50%"
          rx="50%"
          ry="50%"
          clipPath={`url(#ellipseClip-${uniqueId})`}
          className={styles.elementBorder}
        />
      </svg>

      <span className={styles.text}>{data?.text}</span>
    </div>
  );
};

export const ellipseItem: CanvasElementItem<CanvasElementConfig, CanvasElementData> = {
  id: 'ellipse',
  name: 'Ellipse',
  description: 'Ellipse',

  display: Ellipse,

  defaultSize: {
    width: 160,
    height: 160,
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
      width: options?.placement?.width ?? 160,
      height: options?.placement?.height ?? 138,
      top: options?.placement?.top,
      left: options?.placement?.left,
      rotation: options?.placement?.rotation ?? 0,
    },
    links: options?.links ?? [],
  }),

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
    const category = [t('canvas.ellipse-item.category-ellipse', 'Ellipse')];
    builder
      .addCustomEditor({
        category,
        id: 'textSelector',
        path: 'config.text',
        name: t('canvas.ellipse-item.name-text', 'Text'),
        editor: TextDimensionEditor,
      })
      .addCustomEditor({
        category,
        id: 'config.color',
        path: 'config.color',
        name: t('canvas.ellipse-item.name-text-color', 'Text color'),
        editor: ColorDimensionEditor,
        settings: {},
        defaultValue: {},
      })
      .addRadio({
        category,
        path: 'config.align',
        name: t('canvas.ellipse-item.name-align-text', 'Align text'),
        settings: {
          options: [
            { value: Align.Left, label: t('canvas.ellipse-item.label.left', 'Left') },
            { value: Align.Center, label: t('canvas.ellipse-item.label.center', 'Center') },
            { value: Align.Right, label: t('canvas.ellipse-item.label.right', 'Right') },
          ],
        },
        defaultValue: Align.Left,
      })
      .addRadio({
        category,
        path: 'config.valign',
        name: t('canvas.ellipse-item.name-vertical-align', 'Vertical align'),
        settings: {
          options: [
            { value: VAlign.Top, label: t('canvas.ellipse-item.label.top', 'Top') },
            { value: VAlign.Middle, label: t('canvas.ellipse-item.label.middle', 'Middle') },
            { value: VAlign.Bottom, label: t('canvas.ellipse-item.label.bottom', 'Bottom') },
          ],
        },
        defaultValue: VAlign.Middle,
      })
      .addNumberInput({
        category,
        path: 'config.size',
        name: t('canvas.ellipse-item.name-text-size', 'Text size'),
        settings: {
          placeholder: t('canvas.ellipse-item.placeholder.auto', 'Auto'),
        },
      });
  },

  customConnectionAnchors: [
    // points along the left edge
    { x: -1, y: 0 }, // middle left
    { x: -0.7, y: 0.7 },

    // points along the top edge
    { x: 0, y: 1 }, // top
    { x: 0.7, y: 0.7 },

    // points along the right edge
    { x: 1, y: 0 }, // middle right
    { x: 0.7, y: -0.7 },

    // points along the bottom edge
    { x: 0, y: -1 }, // bottom
    { x: -0.7, y: -0.7 },
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
