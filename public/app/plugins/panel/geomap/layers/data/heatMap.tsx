import OpenLayersMap from 'ol/Map';
import { Point } from 'ol/geom';
import * as layer from 'ol/layer';

import {
  EventBus,
  FieldType,
  getFieldColorModeForField,
  GrafanaTheme2,
  MapLayerOptions,
  MapLayerRegistryItem,
  PanelData,
} from '@grafana/data';
import { ScaleDimensionConfig } from '@grafana/schema';
import { ScaleDimensionEditor } from 'app/features/dimensions/editors/ScaleDimensionEditor';
import { getScaledDimension } from 'app/features/dimensions/scale';
import { FrameVectorSource } from 'app/features/geo/utils/frameVectorSource';
import { getLocationMatchers } from 'app/features/geo/utils/location';

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
  description: 'Visualizes a heatmap of the data',
  isBaseMap: false,
  showLocation: true,

  /**
   * Function that configures transformation and returns a transformer
   * @param map
   * @param options
   * @param theme
   */
  create: async (map: OpenLayersMap, options: MapLayerOptions<HeatmapConfig>, eventBus: EventBus, theme: GrafanaTheme2) => {
    const config = { ...defaultOptions, ...options.config };

    const location = await getLocationMatchers(options.location);
    const source = new FrameVectorSource<Point>(location);
    const WEIGHT_KEY = "_weight";

    // Create a new Heatmap layer
    // Weight function takes a feature as attribute and returns a normalized weight value
    const vectorLayer = new layer.Heatmap({
      source,
      blur: config.blur,
      radius: config.radius,
      weight: (feature) => {
        return feature.get(WEIGHT_KEY);
      },
    });

    return {
      init: () => vectorLayer,
      update: (data: PanelData) => {
        const frame = data.series[0];
        if (!frame) {
          return;
        }
        source.update(frame);

        const weightDim = getScaledDimension(frame, config.weight);
        source.forEachFeature( (f) => {
          const idx: number = f.get('rowIndex');
          if(idx != null) {
            f.set(WEIGHT_KEY, weightDim.get(idx));
          }
        });

        // Set heatmap gradient colors
        let colors = ['#00f', '#0ff', '#0f0', '#ff0', '#f00'];

        // Either the configured field or the first numeric field value
        const field = weightDim.field ?? frame.fields.find((field) => field.type === FieldType.number);
        if (field) {
          const colorMode = getFieldColorModeForField(field);
          if (colorMode.isContinuous && colorMode.getColors) {
            // getColors return an array of color string from the color scheme chosen
            colors = colorMode.getColors(theme);
          }
        }
        vectorLayer.setGradient(colors);
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
            defaultValue: {
              // Configured values
              fixed: 1,
              min: 0,
              max: 1,
            },
          })
          .addSliderInput({
            path: 'config.radius',
            description: 'Configures the size of clusters',
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
            description: 'Configures the amount of blur of clusters',
            name: 'Blur',
            defaultValue: defaultOptions.blur,
            settings: {
              min: 1,
              max: 50,
              step: 1,
            },
          });
      },
    };
  },
  // fill in the default values
  defaultOptions,
};
