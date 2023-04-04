import { css } from '@emotion/css';
import { isString } from 'lodash';
import React, { CSSProperties } from 'react';

import { SanitizedSVG } from 'app/core/components/SVG/SanitizedSVG';
import {
  ColorDimensionConfig,
  ResourceDimensionConfig,
  ResourceDimensionMode,
  getPublicOrAbsoluteUrl,
} from 'app/features/dimensions';
import { DimensionContext } from 'app/features/dimensions/context';
import { ColorDimensionEditor, ResourceDimensionEditor } from 'app/features/dimensions/editors';
import { APIEditorConfig, callApi } from 'app/plugins/panel/canvas/editor/APIEditor';

import { CanvasElementItem, CanvasElementProps, defaultBgColor } from '../element';
import { LineConfig } from '../types';

export interface IconConfig {
  path?: ResourceDimensionConfig;
  fill?: ColorDimensionConfig;
  stroke?: LineConfig;
  api?: APIEditorConfig;
}

interface IconData {
  path: string;
  fill: string;
  strokeColor?: string;
  stroke?: number;
  api?: APIEditorConfig;
}

// When a stoke is defined, we want the path to be in page units
const svgStrokePathClass = css`
  path {
    vector-effect: non-scaling-stroke;
  }
`;

export function IconDisplay(props: CanvasElementProps) {
  const { data } = props;
  if (!data?.path) {
    return null;
  }

  const onClick = () => {
    if (data?.api) {
      callApi(data.api);
    }
  };

  const svgStyle: CSSProperties = {
    fill: data?.fill,
    stroke: data?.strokeColor,
    strokeWidth: data?.stroke,
    height: '100%',
    width: '100%',
  };

  return (
    <SanitizedSVG
      onClick={onClick}
      src={data.path}
      style={svgStyle}
      className={svgStyle.strokeWidth ? svgStrokePathClass : undefined}
    />
  );
}

export const iconItem: CanvasElementItem<IconConfig, IconData> = {
  id: 'icon',
  name: 'Icon',
  description: 'SVG Icon display',

  display: IconDisplay,

  getNewOptions: (options) => ({
    placement: {
      width: 100,
      height: 100,
      top: 0,
      left: 0,
    },
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
  }),

  // Called when data changes
  prepareData: (ctx: DimensionContext, cfg: IconConfig) => {
    let path: string | undefined = undefined;
    if (cfg.path) {
      path = ctx.getResource(cfg.path).value();
    }
    if (!path || !isString(path)) {
      path = getPublicOrAbsoluteUrl('img/icons/unicons/question-circle.svg');
    }

    const data: IconData = {
      path,
      fill: cfg.fill ? ctx.getColor(cfg.fill).value() : defaultBgColor,
      api: cfg?.api ?? undefined,
    };

    if (cfg.stroke?.width && cfg.stroke.color) {
      if (cfg.stroke.width > 0) {
        data.stroke = cfg.stroke?.width;
        data.strokeColor = ctx.getColor(cfg.stroke.color).value();
      }
    }
    return data;
  },

  // Heatmap overlay options
  registerOptionsUI: (builder) => {
    const category = ['Icon'];
    builder
      .addCustomEditor({
        category,
        id: 'iconSelector',
        path: 'config.path',
        name: 'SVG Path',
        editor: ResourceDimensionEditor,
        settings: {
          resourceType: 'icon',
        },
      })
      .addCustomEditor({
        category,
        id: 'config.fill',
        path: 'config.fill',
        name: 'Fill color',
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
    // .addCustomEditor({
    //   category,
    //   id: 'apiSelector',
    //   path: 'config.api',
    //   name: 'API',
    //   editor: APIEditor,
    // });
  },
};
