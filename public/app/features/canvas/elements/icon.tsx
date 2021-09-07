import React, { CSSProperties } from 'react';

import { CanvasElementItem, CanvasElementProps } from '../element';
import { ColorDimensionConfig, ResourceDimensionConfig, ResourceDimensionMode } from 'app/features/dimensions';
import { ColorDimensionEditor, ResourceDimensionEditor } from 'app/features/dimensions/editors';
import SVG from 'react-inlinesvg';
import { css } from '@emotion/css';
import { isString } from 'lodash';
import { LineConfig } from '../types';
import { DimensionContext } from 'app/features/dimensions/context';

interface IconConfig {
  path?: ResourceDimensionConfig;
  fill?: ColorDimensionConfig;
  stroke?: LineConfig;
}

interface IconData {
  path: string;
  fill: string;
  strokeColor?: string;
  stroke?: number;
}

// When a stoke is defined, we want the path to be in page units
const svgStrokePathClass = css`
  path {
    vector-effect: non-scaling-stroke;
  }
`;

export function IconDisplay(props: CanvasElementProps) {
  const { width, height, data } = props;
  if (!data?.path) {
    return null;
  }

  const svgStyle: CSSProperties = {
    fill: data?.fill,
    stroke: data?.strokeColor,
    strokeWidth: data?.stroke,
  };

  return (
    <SVG
      src={data.path}
      width={width}
      height={height}
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

  defaultConfig: {
    path: {
      mode: ResourceDimensionMode.Fixed,
      fixed: 'question-circle.svg',
    },
    fill: { fixed: '#FFF899' },
  },

  defaultSize: {
    width: 50,
    height: 50,
  },

  // Called when data changes
  prepareData: (ctx: DimensionContext, cfg: IconConfig) => {
    const iconRoot = (window as any).__grafana_public_path__ + 'img/icons/unicons/';
    let path: string | undefined = undefined;
    if (cfg.path) {
      path = ctx.getResource(cfg.path).value();
    }
    if (!path || !isString(path)) {
      // must be something?
      path = 'question-circle.svg';
    }
    if (path.indexOf(':/') < 0) {
      path = iconRoot + path;
    }

    const data: IconData = {
      path,
      fill: cfg.fill ? ctx.getColor(cfg.fill).value() : '#CCC',
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
    builder
      .addCustomEditor({
        id: 'iconSelector',
        path: 'config.path',
        name: 'SVG Path',
        editor: ResourceDimensionEditor,
        settings: {
          resourceType: 'icon',
        },
      })
      .addCustomEditor({
        id: 'config.fill',
        path: 'config.fill',
        name: 'Icon fill color',
        editor: ColorDimensionEditor,
        settings: {},
        defaultValue: {
          // Configured values
          fixed: 'grey',
        },
      })
      .addSliderInput({
        path: 'config.stroke.width',
        name: 'Stroke',
        defaultValue: 0,
        settings: {
          min: 0,
          max: 10,
        },
      })
      .addCustomEditor({
        id: 'config.stroke.color',
        path: 'config.stroke.color',
        name: 'Icon Stroke color',
        editor: ColorDimensionEditor,
        settings: {},
        defaultValue: {
          // Configured values
          fixed: 'grey',
        },
        showIf: (cfg) => Boolean(cfg.config?.stroke?.width),
      });
  },
};
