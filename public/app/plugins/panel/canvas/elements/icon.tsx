import React from 'react';

import { CanvasSceneContext, CanvasElementItem, CanvasElementProps, LineConfig } from '../base';
import SVG from 'react-inlinesvg';
import { ColorDimensionConfig } from '../../geomap/dims/types';
import { ColorDimensionEditor } from '../../geomap/dims/editors/ColorDimensionEditor';
import IconSelector from '../components/IconSelector';
import { css } from '@emotion/css';

interface IconConfig {
  path?: string;
  fill?: ColorDimensionConfig;
  stroke?: LineConfig;
}

interface IconData {
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
  const { config, width, height, data } = props;
  console.log(config);
  const iconRoot = (window as any).__grafana_public_path__ + 'img/icons/unicons/';
  const svgStyle = {
    fill: data?.fill,
    stroke: data?.strokeColor,
    strokeWidth: data?.stroke,
  };
  let path = config?.path ?? 'question-circle.svg';
  if (path.indexOf(':/') < 0) {
    path = iconRoot + path;
  }

  return (
    <SVG
      src={path}
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

  defaultOptions: {
    path: 'question-circle.svg',
    fill: { fixed: '#FFF899' },
  },

  defaultSize: {
    width: 50,
    height: 50,
  },

  // Called when data changes
  prepareData: (ctx: CanvasSceneContext, cfg: IconConfig) => {
    const data: IconData = {
      fill: ctx.getColor(cfg.fill ?? { fixed: '#CCC' }).value(),
    };

    if (cfg.stroke?.width && cfg.stroke.color) {
      data.stroke = cfg.stroke?.width;
      data.strokeColor = ctx.getColor(cfg.stroke.color).value();
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
        editor: IconSelector,
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
