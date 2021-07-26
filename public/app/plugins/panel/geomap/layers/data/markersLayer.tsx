import { MapLayerRegistryItem, MapLayerOptions, PanelData, GrafanaTheme2, FrameGeometrySourceMode } from '@grafana/data';
import Map from 'ol/Map';
import Feature from 'ol/Feature';
import * as layer from 'ol/layer';
import * as source from 'ol/source';

import tinycolor from 'tinycolor2';
import { dataFrameToPoints, getLocationMatchers } from '../../utils/location';
import { ColorDimensionConfig, ScaleDimensionConfig, } from '../../dims/types';
import { getScaledDimension, } from '../../dims/scale';
import { getColorDimension, } from '../../dims/color';
import { ScaleDimensionEditor } from '../../dims/editors/ScaleDimensionEditor';
import { ColorDimensionEditor } from '../../dims/editors/ColorDimensionEditor';
import { circleMarker, markerMakers } from '../../utils/regularShapes';

// Configuration options for Circle overlays
export interface MarkersConfig {
  size: ScaleDimensionConfig;
  color: ColorDimensionConfig;
  fillOpacity: number;
  shape?: string;
}

const defaultOptions: MarkersConfig = {
  size: {
    fixed: 5,
    min: 2,
    max: 15,
  },
  color: {
    fixed: 'dark-green', // picked from theme 
  },
  fillOpacity: 0.4,
  shape: 'circle',
};

export const MARKERS_LAYER_ID = "markers";

// Used by default when nothing is configured
export const defaultMarkersConfig:MapLayerOptions<MarkersConfig> = {
  type: MARKERS_LAYER_ID,
  config: defaultOptions,
  location: {
    mode: FrameGeometrySourceMode.Auto,
  }
}

/**
 * Map layer configuration for circle overlay
 */
export const markersLayer: MapLayerRegistryItem<MarkersConfig> = {
  id: MARKERS_LAYER_ID,
  name: 'Markers',
  description: 'use markers to render each data point',
  isBaseMap: false,
  showLocation: true,

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: async (map: Map, options: MapLayerOptions<MarkersConfig>, theme: GrafanaTheme2) => {
    const matchers = await getLocationMatchers(options.location);
    const vectorLayer = new layer.Vector({});
    // Assert default values
    const config = {
      ...defaultOptions,
      ...options?.config,
    };

    const shape = markerMakers.getIfExists(config.shape) ?? circleMarker;

    return {
      init: () => vectorLayer,
      update: (data: PanelData) => {
        if(!data.series?.length) {
          return; // ignore empty
        }

        const features: Feature[] = [];

        for(const frame of data.series) {
          const info = dataFrameToPoints(frame, matchers);
          if(info.warning) {
            console.log( 'Could not find locations', info.warning);
            continue; // ???
          }

          const colorDim = getColorDimension(frame, config.color, theme);
          const sizeDim = getScaledDimension(frame, config.size);
          const opacity = options.config?.fillOpacity ?? defaultOptions.fillOpacity;

          // Map each data value into new points
          for (let i = 0; i < frame.length; i++) {
            // Get the circle color for a specific data value depending on color scheme
            const color = colorDim.get(i);
            // Set the opacity determined from user configuration
            const fillColor = tinycolor(color).setAlpha(opacity).toRgbString();
            // Get circle size from user configuration
            const radius = sizeDim.get(i);

            // Create a new Feature for each point returned from dataFrameToPoints
            const dot = new Feature({
                geometry: info.points[i],
            });

            dot.setStyle(shape!.make(color, fillColor, radius));
            features.push(dot);
          };
        }


        // Source reads the data and provides a set of features to visualize
        const vectorSource = new source.Vector({ features });
        vectorLayer.setSource(vectorSource);
      },
    };
  },
  // Marker overlay options
  registerOptionsUI: (builder) => {
    builder
      .addCustomEditor({
        id: 'config.color',
        path: 'config.color',
        name: 'Marker Color',
        editor: ColorDimensionEditor,
        settings: {},
        defaultValue: { // Configured values
          fixed: 'grey',
        },
      })
      .addCustomEditor({
        id: 'config.size',
        path: 'config.size',
        name: 'Marker Size',
        editor: ScaleDimensionEditor,
        settings: {
          min: 1,
          max: 100, // possible in the UI
        },
        defaultValue: { // Configured values
          fixed: 5,
          min: 1,
          max: 20,
        },
      })
      .addSelect({
        path: 'config.shape',
        name: 'Marker Shape',
        settings: {
          options: markerMakers.selectOptions().options,
        },
        defaultValue: 'circle',
      })
      .addSliderInput({
        path: 'config.fillOpacity',
        name: 'Fill opacity',
        defaultValue: defaultOptions.fillOpacity,
        settings: {
          min: 0,
          max: 1,
          step: 0.1,
        },
        showIf: (cfg) => (markerMakers.getIfExists((cfg as any).config?.shape)?.hasFill),
      });
  },

  // fill in the default values
  defaultOptions,
};
