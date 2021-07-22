import {
  FieldType,
  getFieldColorModeForField,
  GrafanaTheme2,
  MapLayerHandler,
  MapLayerOptions,
  MapLayerRegistryItem,
  PanelData,
} from '@grafana/data';
import Map from 'ol/Map';
import Feature from 'ol/Feature';
import * as layer from 'ol/layer';
import * as source from 'ol/source';
import { dataFrameToPoints, getLocationMatchers } from '../../utils/location';
import { ScaleDimensionConfig, } from '../../dims/types';
import { ScaleDimensionEditor } from '../../dims/editors/ScaleDimensionEditor';
import { getScaledDimension } from '../../dims/scale';

// Configuration options for Heatmap overlays
export interface HeatmapConfig {
  weight: ScaleDimensionConfig;
  blur: number;
  radius: number;
}

const defaultOptions: HeatmapConfig = {
  weight: {
    fixed: 1,
    min: 0, 
    max: 1,
  },
  blur: 15,
  radius: 5,
};

/**
 * Map layer configuration for heatmap overlay
 */
export const heatmapLayer: MapLayerRegistryItem<HeatmapConfig> = {
  id: 'heatmap',
  name: 'Heatmap',
  description: 'visualizes a heatmap of the data',
  isBaseMap: false,
  showLocation: true,

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: (map: Map, options: MapLayerOptions<HeatmapConfig>, theme: GrafanaTheme2): MapLayerHandler => {
    const config = { ...defaultOptions, ...options.config };
    const matchers = getLocationMatchers(options.location);

    const vectorSource = new source.Vector();

    // Create a new Heatmap layer
    // Weight function takes a feature as attribute and returns a normalized weight value
    const vectorLayer = new layer.Heatmap({
      source: vectorSource,
      blur: config.blur,
      radius: config.radius,
      weight: function (feature) {
        var weight = feature.get('value');
        return weight;
      },
    });

    return {
      init: () => vectorLayer,
      update: (data: PanelData) => {
        const frame = data.series[0];

        // Remove previous data before updating
        const features = vectorLayer.getSource().getFeatures();
        features.forEach((feature) => {
          vectorLayer.getSource().removeFeature(feature);
        });

        // Get data points (latitude and longitude coordinates)
        const info = dataFrameToPoints(frame, matchers);
        if(info.warning) {
          console.log( 'WARN', info.warning);
          return; // ???
        }

        const weightDim = getScaledDimension(frame, config.weight);

        // Map each data value into new points
        for (let i = 0; i < frame.length; i++) {
          const cluster = new Feature({
              geometry: info.points[i],
              value: weightDim.get(i),
          });
          vectorSource.addFeature(cluster);
        };
        vectorLayer.setSource(vectorSource);

        // Set heatmap gradient colors
        let colors = ['#00f', '#0ff', '#0f0', '#ff0', '#f00'];

        // Either the configured field or the first numeric field value
        const field = weightDim.field ?? frame.fields.find(field => field.type === FieldType.number);
        if (field) {
          const colorMode = getFieldColorModeForField(field);
          if (colorMode.isContinuous && colorMode.getColors) {
            // getColors return an array of color string from the color scheme chosen
            colors = colorMode.getColors(theme);
          }
        }
        vectorLayer.setGradient(colors);
      },
    };
  },
  // Heatmap overlay options
  registerOptionsUI: (builder) => {
    builder
      .addCustomEditor({
        id: 'config.weight',
        path: 'config.weight',
        name: 'Weight values',
        description: 'Scale the distribution for each row',
        editor: ScaleDimensionEditor,
        settings: {
          min: 0, // no contribution
          max: 1,
          hideRange: true, // Don't show the scale factor
        },
        defaultValue: { // Configured values
          fixed: 1,
          min: 0,
          max: 1,
        },
      })
      .addSliderInput({
        path: 'config.radius',
        description: 'configures the size of clusters',
        name: 'Radius',
        defaultValue: defaultOptions.radius,
        settings: {
            min: 1,
            max: 50,
            step: 1,
        },
      })
      .addSliderInput({
        path: 'config.blur',
        description: 'configures the amount of blur of clusters',
        name: 'Blur',
        defaultValue: defaultOptions.blur,
        settings: {
          min: 1,
          max: 50,
          step: 1,
        },
      });
  },
  // fill in the default values
  defaultOptions,
};
