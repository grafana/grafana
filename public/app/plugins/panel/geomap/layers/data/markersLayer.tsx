import { MapLayerRegistryItem, MapLayerOptions, MapLayerHandler, PanelData, GrafanaTheme2 } from '@grafana/data';
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
import { IconPickerEditor } from '../../editor/IconPickerEditor';
import { shapes } from '../../utils/regularShapes';

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
    min: 5,
    max: 10,
  },
  color: {
    fixed: '#f00', 
  },
  fillOpacity: 0.4,
  shape: ''
};

export const MARKERS_LAYER_ID = "markers";

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
    let legend: React.ReactNode =  null;
    return {
      init: () => vectorLayer,
      // TODO: going to leave it here in case we want to go down
      // this path of implementing legend
      legend: () => {
        return legend;
      },
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

        // Assert default values
        const config = {
          ...defaultOptions,
          ...options?.config,
        };
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
          // choose from dropdown of regular shapes
          const shapesArr = shapes(color, fillColor, radius);
          const shape = shapesArr.find(el => el.label === config.shape);
          dot.setStyle(shape?.value);
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
      })
      .addCustomEditor({
        id: 'shape',
        path: 'config.shape',
        name: 'Shape',
        editor: IconPickerEditor,
        defaultValue: 'circle',
      });
  },
  // fill in the default values
  defaultOptions,
};
