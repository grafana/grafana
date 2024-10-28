import Map from 'ol/Map';
import { Point } from 'ol/geom';
import WebGLPointsLayer from 'ol/layer/WebGLPoints.js';
import { ReactNode } from 'react';
import { ReplaySubject } from 'rxjs';
import tinycolor from 'tinycolor2';

import {
  MapLayerRegistryItem,
  MapLayerOptions,
  PanelData,
  GrafanaTheme2,
  FrameGeometrySourceMode,
  EventBus,
} from '@grafana/data';
import { FrameVectorSource } from 'app/features/geo/utils/frameVectorSource';
import { getLocationMatchers } from 'app/features/geo/utils/location';

import { MarkersLegend, MarkersLegendProps } from '../../components/MarkersLegend';
import { ObservablePropsWrapper } from '../../components/ObservablePropsWrapper';
import { StyleEditor } from '../../editor/StyleEditor';
import { defaultStyleConfig, StyleConfig } from '../../style/types';
import { getStyleConfigState } from '../../style/utils';
import { getStyleDimension } from '../../utils/utils';

// Configuration options for Circle overlays
export interface MarkersConfig {
  style: StyleConfig;
  showLegend?: boolean;
}

const defaultOptions: MarkersConfig = {
  style: defaultStyleConfig,
  showLegend: true,
};

export const MARKERS_LAYER_ID = 'markers';

// Used by default when nothing is configured
export const defaultMarkersConfig: MapLayerOptions<MarkersConfig> = {
  type: MARKERS_LAYER_ID,
  name: '', // will get replaced
  config: defaultOptions,
  location: {
    mode: FrameGeometrySourceMode.Auto,
  },
  tooltip: true,
};

/**
 * Map layer configuration for circle overlay
 */
export const markersLayer: MapLayerRegistryItem<MarkersConfig> = {
  id: MARKERS_LAYER_ID,
  name: 'Markers',
  description: 'Use markers to render each data point',
  isBaseMap: false,
  showLocation: true,
  hideOpacity: true,

  /**
   * Function that configures transformation and returns a transformer
   * @param map
   * @param options
   * @param theme
   */
  create: async (map: Map, options: MapLayerOptions<MarkersConfig>, eventBus: EventBus, theme: GrafanaTheme2) => {
    // Assert default values
    const config = {
      ...defaultOptions,
      ...options?.config,
    };

    const style = await getStyleConfigState(config.style);

    // TODO custom icon options and alignment
    const newStyle = {
      symbol: {
        symbolType: 'image',
        offset: [0, 12],
        size: [4, 8],
        src: '../static/exclamation-mark.png',
      },
    };
    const styleTriangle = {
      symbol: {
        symbolType: 'triangle',
        size: ['get', 'size', 'number'],
        color: ['color', ['get', 'red'], ['get', 'green'], ['get', 'blue']],
        rotation: ['get', 'rotation', 'number'],
        opacity: ['get', 'opacity', 'number'],
      },
    };
    const location = await getLocationMatchers(options.location);
    const source = new FrameVectorSource<Point>(location);
    const vectorLayer = new WebGLPointsLayer({ source, style: styleTriangle });

    const legendProps = new ReplaySubject<MarkersLegendProps>(1);
    let legend: ReactNode = null;
    if (config.showLegend) {
      legend = <ObservablePropsWrapper watch={legendProps} initialSubProps={{}} child={MarkersLegend} />;
    }

    return {
      init: () => vectorLayer,
      legend: legend,
      update: (data: PanelData) => {
        if (!data.series?.length) {
          source.clear();
          return; // ignore empty
        }

        for (const frame of data.series) {
          style.dims = getStyleDimension(frame, style, theme);

          // Post updates to the legend component
          if (legend) {
            legendProps.next({
              styleConfig: style,
              size: style.dims?.size,
              layerName: options.name,
              layer: vectorLayer,
            });
          }

          source.update(frame);
          source.forEachFeature((feature) => {
            const idx: number = feature.get('rowIndex');
            const dims = style.dims;
            const values = { ...style.base };

            if (dims?.color) {
              values.color = dims.color.get(idx);
            }
            if (dims?.size) {
              values.size = dims.size.get(idx);
            }
            if (dims?.text) {
              values.text = dims.text.get(idx);
            }
            if (dims?.rotation) {
              values.rotation = dims.rotation.get(idx);
            }
            const colorString = tinycolor(theme.visualization.getColorByName(values.color)).toString();
            const colorValues = getRGBValues(colorString);

            feature.setProperties({ red: colorValues?.r ?? 255 });
            feature.setProperties({ green: colorValues?.g ?? 0 });
            feature.setProperties({ blue: colorValues?.b ?? 0 });
            feature.setProperties({ size: (values.size ?? 1) * 3 }); // TODO figure out size conversion
            feature.setProperties({ rotation: values.rotation });
            feature.setProperties({ opacity: values.opacity });
          });
          break; // Only the first frame for now!
        }
      },

      // Marker overlay options
      registerOptionsUI: (builder) => {
        builder
          .addCustomEditor({
            id: 'config.style',
            path: 'config.style',
            name: 'Styles',
            editor: StyleEditor,
            settings: {
              displayRotation: true,
            },
            defaultValue: defaultOptions.style,
          })
          .addBooleanSwitch({
            path: 'config.showLegend',
            name: 'Show legend',
            description: 'Show map legend',
            defaultValue: defaultOptions.showLegend,
          });
      },
    };
  },

  // fill in the default values
  defaultOptions,
};

function getRGBValues(colorString: string) {
  // Check if it's a hex color
  if (colorString.startsWith('#')) {
    return getRGBFromHex(colorString);
  }

  // Check if it's an RGB color
  else if (colorString.startsWith('rgb')) {
    return getRGBFromRGBString(colorString);
  }

  // Handle other color formats if needed
  else {
    console.warn(`Unsupported color format: ${colorString}`);
  }
  return null;
}

function getRGBFromHex(hexColor: string) {
  // Remove the '#' character
  hexColor = hexColor.slice(1);

  // Convert hex to decimal values
  const r = parseInt(hexColor.slice(0, 2), 16);
  const g = parseInt(hexColor.slice(2, 4), 16);
  const b = parseInt(hexColor.slice(4, 6), 16);

  return { r, g, b };
}

function getRGBFromRGBString(rgbString: string) {
  // Use regex to extract the numbers
  const matches = rgbString.match(/\d+/g);

  if (matches && matches.length === 3) {
    return {
      r: parseInt(matches[0], 10),
      g: parseInt(matches[1], 10),
      b: parseInt(matches[2], 10),
    };
  } else {
    console.warn(`Unsupported color format: ${rgbString}`);
  }
  return null;
}
