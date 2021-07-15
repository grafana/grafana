import { MapLayerRegistryItem, MapLayerOptions, MapLayerHandler, PanelData, GrafanaTheme2, reduceField, ReducerID, FieldCalcs, FieldType } from '@grafana/data';
import Map from 'ol/Map';
import Feature from 'ol/Feature';
import * as layer from 'ol/layer';
import * as source from 'ol/source';
import * as style from 'ol/style';
import tinycolor from 'tinycolor2';
import { dataFrameToPoints, getLocationMatchers } from '../../utils/location';

// Configuration options for Circle overlays
export interface MarkersConfig {
  minSize: number,
  maxSize: number,
  opacity: number,
}

const defaultOptions: MarkersConfig = {
  minSize: 1,
  maxSize: 10,
  opacity: 0.4,
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
    const config = { ...defaultOptions, ...options.config };
    const matchers = getLocationMatchers(options.location);

    const vectorLayer = new layer.Vector({});
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

        const field = frame.fields.find(field => field.type === FieldType.number); // TODO!!!!
        // Return early if metric field is not matched
        if (field === undefined) {
          return;
        };

        // Retrieve the min, max and range of data values
        const calcs = reduceField({
          field: field,
          reducers: [
            ReducerID.min,
            ReducerID.max,
            ReducerID.range,
          ]
        });

        const features: Feature[] = [];

        // Map each data value into new points
        for (let i = 0; i < frame.length; i++) {
          // Get the circle color for a specific data value depending on color scheme
          const color = frame.fields[0].display!(field.values.get(i)).color;
          // Set the opacity determined from user configuration
          const fillColor = tinycolor(color).setAlpha(config.opacity).toRgbString();

          // Get circle size from user configuration
          const radius = calcCircleSize(calcs, field.values.get(i), config.minSize, config.maxSize);

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
  // Circle overlay options
  registerOptionsUI: (builder) => {
    builder
      // .addFieldNamePicker({
      //   path: 'fieldMapping.metricField',
      //   name: 'Metric Field',
      //   defaultValue: defaultOptions.fieldMapping.metricField,
      //   settings: {
      //     filter: (f) => f.type === FieldType.number,
      //     noFieldsMessage: 'No numeric fields found',
      //   },
      // })
      .addNumberInput({
        path: 'config.minSize',
        description: 'configures the min circle size',
        name: 'Min Size',
        defaultValue: defaultOptions.minSize,
      })
      .addNumberInput({
        path: 'config.maxSize',
        description: 'configures the max circle size',
        name: 'Max Size',
        defaultValue: defaultOptions.maxSize,
      })
      .addSliderInput({
        path: 'config.opacity',
        description: 'configures the amount of transparency',
        name: 'Opacity',
        defaultValue: defaultOptions.opacity,
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

/**
 * Function that scales the circle size depending on the current data and user defined configurations
 * Returns the scaled value in the range of min and max circle size
 * Ex. If the minSize and maxSize were 5, 15: all values returned will be between 5~15
 */
function calcCircleSize(calcs: FieldCalcs, value: number, minSize: number, maxSize: number) {
  if (calcs.range === 0) {
    return maxSize;
  }

  const dataFactor = (value - calcs.min) / calcs.max;
  const circleSizeRange = maxSize - minSize;
  return circleSizeRange * dataFactor + minSize;
};
