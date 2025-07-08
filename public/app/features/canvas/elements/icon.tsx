import { css } from '@emotion/css';
import { isString } from 'lodash';
import { CSSProperties } from 'react';

import { LinkModel } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ColorDimensionConfig, ResourceDimensionConfig, ResourceDimensionMode } from '@grafana/schema';
import { SanitizedSVG } from 'app/core/components/SVG/SanitizedSVG';
import { DimensionContext } from 'app/features/dimensions/context';
import { ColorDimensionEditor } from 'app/features/dimensions/editors/ColorDimensionEditor';
import { ResourceDimensionEditor } from 'app/features/dimensions/editors/ResourceDimensionEditor';
import { getPublicOrAbsoluteUrl } from 'app/features/dimensions/resource';
import { LineConfig } from 'app/plugins/panel/canvas/panelcfg.gen';

import { CanvasElementItem, CanvasElementOptions, CanvasElementProps, defaultBgColor } from '../element';

export interface IconConfig {
  path?: ResourceDimensionConfig;
  fill?: ColorDimensionConfig;
  stroke?: LineConfig;
}

interface IconData {
  path: string;
  fill: string;
  strokeColor?: string;
  stroke?: number;
  links?: LinkModel[];
}

// When a stoke is defined, we want the path to be in page units
const svgStrokePathClass = css({
  path: {
    vectorEffect: 'non-scaling-stroke',
  },
});

export function IconDisplay(props: CanvasElementProps<IconConfig, IconData>) {
  const { data } = props;
  if (!data?.path) {
    return null;
  }

  const svgStyle: CSSProperties = {
    fill: data?.fill,
    stroke: data?.strokeColor,
    strokeWidth: data?.stroke,
    height: '100%',
    width: '100%',
  };

  return (
    <SanitizedSVG src={data.path} style={svgStyle} className={svgStyle.strokeWidth ? svgStrokePathClass : undefined} />
  );
}

export const iconItem: CanvasElementItem<IconConfig, IconData> = {
  id: 'icon',
  name: 'Icon',
  description: 'SVG Icon display',

  display: IconDisplay,

  getNewOptions: (options) => ({
    ...options,
    config: {
      path: {
        mode: ResourceDimensionMode.Fixed,
        fixed: 'img/icons/unicons/question-circle.svg',
      },
      fill: { fixed: defaultBgColor },
    },
    background: {
      color: {
        fixed: 'transparent',
      },
    },
    placement: {
      width: options?.placement?.width ?? 100,
      height: options?.placement?.height ?? 100,
      top: options?.placement?.top ?? 100,
      left: options?.placement?.left ?? 100,
      rotation: options?.placement?.rotation ?? 0,
    },
    links: options?.links ?? [],
  }),

  // Called when data changes
  prepareData: (dimensionContext: DimensionContext, elementOptions: CanvasElementOptions<IconConfig>) => {
    const iconConfig = elementOptions.config;

    let path: string | undefined = undefined;
    if (iconConfig?.path) {
      path = dimensionContext.getResource(iconConfig.path).value();
    }
    if (!path || !isString(path)) {
      path = getPublicOrAbsoluteUrl('img/icons/unicons/question-circle.svg');
    }

    const data: IconData = {
      path,
      fill: iconConfig?.fill ? dimensionContext.getColor(iconConfig.fill).value() : defaultBgColor,
    };

    if (iconConfig?.stroke?.width && iconConfig?.stroke.color) {
      if (iconConfig.stroke.width > 0) {
        data.stroke = iconConfig.stroke?.width;
        data.strokeColor = dimensionContext.getColor(iconConfig.stroke.color).value();
      }
    }

    return data;
  },

  // Heatmap overlay options
  registerOptionsUI: (builder) => {
    const category = [t('canvas.icon-item.category-icon', 'Icon')];
    builder
      .addCustomEditor({
        category,
        id: 'iconSelector',
        path: 'config.path',
        name: t('canvas.icon-item.name-svg-path', 'SVG Path'),
        editor: ResourceDimensionEditor,
        settings: {
          resourceType: 'icon',
          maxFiles: 2000,
        },
      })
      .addCustomEditor({
        category,
        id: 'config.fill',
        path: 'config.fill',
        name: t('canvas.icon-item.name-fill-color', 'Fill color'),
        editor: ColorDimensionEditor,
        settings: {},
        defaultValue: {
          // Configured values
          fixed: 'grey',
        },
      });
    // .addSliderInput({
    //   category,
    //   path: 'config.stroke.width',
    //   name: 'Stroke',
    //   defaultValue: 0,
    //   settings: {
    //     min: 0,
    //     max: 10,
    //   },
    // })
    // .addCustomEditor({
    //   category,
    //   id: 'config.stroke.color',
    //   path: 'config.stroke.color',
    //   name: 'Stroke color',
    //   editor: ColorDimensionEditor,
    //   settings: {},
    //   defaultValue: {
    //     // Configured values
    //     fixed: 'grey',
    //   },
    //   showIf: (cfg) => Boolean(cfg?.config?.stroke?.width),
    // })
  },
};
