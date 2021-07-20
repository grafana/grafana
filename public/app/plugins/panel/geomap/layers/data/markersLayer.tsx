import { MapLayerRegistryItem, MapLayerOptions, MapLayerHandler, PanelData, GrafanaTheme2, FrameGeometrySourceMode } from '@grafana/data';
import Map from 'ol/Map';
import Feature from 'ol/Feature';
import * as layer from 'ol/layer';
import * as source from 'ol/source';
import * as style from 'ol/style';
import tinycolor from 'tinycolor2';
import { dataFrameToPoints, getLocationMatchers } from '../../utils/location';
import { ColorDimensionConfig, ScaleDimensionConfig, } from '../../dims/types';
import { getScaledDimension, } from '../../dims/scale';
import { getColorDimension, } from '../../dims/color';
import { ScaleDimensionEditor } from '../../dims/editors/ScaleDimensionEditor';
import { ColorDimensionEditor } from '../../dims/editors/ColorDimensionEditor';


// Configuration options for Circle overlays
export interface MarkersConfig {
  size: ScaleDimensionConfig;
  color: ColorDimensionConfig;
  fillOpacity: number;
}

const defaultOptions: MarkersConfig = {
  size: {
    fixed: 5,
    min: 2,
    max: 15,
  },
  color: {
    fixed: '#f00', 
  },
  fillOpacity: 0.4,
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
  create: (map: Map, options: MapLayerOptions<MarkersConfig>, theme: GrafanaTheme2): MapLayerHandler => {
    const matchers = getLocationMatchers(options.location);
    const vectorLayer = new layer.Vector({});
    // Assert default values
    const config = {
      ...defaultOptions,
      ...options?.config,
    };
    
    return {
      init: () => vectorLayer,
      update: (data: PanelData) => {
        if(!data.series?.length) {
          return; // ignore empty
        }
        const frame = data.series[0];
        const info = dataFrameToPoints(frame, matchers);
        if(info.warning) {
          console.log( 'WARN', info.warning);
          return; // ???
        }

        const colorDim = getColorDimension(frame, config.color, theme);
        const sizeDim = getScaledDimension(frame, config.size);
        const opacity = options.config?.fillOpacity ?? defaultOptions.fillOpacity;

        const features: Feature[] = [];

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

          // Set the style of each feature dot
          dot.setStyle(new style.Style({
            image: new style.Circle({
              // Stroke determines the outline color of the circle
              stroke: new style.Stroke({
                color: color,
              }),
              // Fill determines the color to fill the whole circle
              fill: new style.Fill({
                color: tinycolor(fillColor).toString(),
              }),
              radius: radius,
            })
          }));
          features.push(dot);
        };

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
      .addSliderInput({
          path: 'config.fillOpacity',
          name: 'Fill opacity',
          defaultValue: defaultOptions.fillOpacity,
          settings: {
            min: 0,
            max: 1,
            step: 0.1,
          },
        });
  },

  // fill in the default values
  defaultOptions,
};
