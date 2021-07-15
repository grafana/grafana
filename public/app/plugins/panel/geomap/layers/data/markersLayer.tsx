import React from 'react';
import { MapLayerRegistryItem, MapLayerConfig, MapLayerHandler, PanelData, GrafanaTheme2, reduceField, ReducerID, FieldCalcs, FieldType } from '@grafana/data';
import { dataFrameToPoints } from './utils'
import { FieldMappingOptions, QueryFormat } from '../../types'
import Map from 'ol/Map';
import Feature from 'ol/Feature';
import * as layer from 'ol/layer';
import * as source from 'ol/source';
import * as style from 'ol/style';
import tinycolor from 'tinycolor2';

// Configuration options for Circle overlays
export interface MarkersConfig {
  queryFormat: QueryFormat,
  fieldMapping: FieldMappingOptions,
  minSize: number,
  maxSize: number,
  opacity: number,
}

const defaultOptions: MarkersConfig = {
  queryFormat: {
    locationType: 'coordinates',
  },
  fieldMapping: {
    metricField: '',
    geohashField: '',
    latitudeField: '',
    longitudeField: '',
  },
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

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: (map: Map, options: MapLayerConfig<MarkersConfig>, theme: GrafanaTheme2): MapLayerHandler => {
    const config = { ...defaultOptions, ...options.config };

    const vectorLayer = new layer.Vector({});
    return {
      init: () => vectorLayer,
      update: (data: PanelData) => {
        const features: Feature[] = [];
        const frame = data.series[0];

        // Get data values
        const points = dataFrameToPoints(frame, config.fieldMapping, config.queryFormat);
        const field = frame.fields.find(field => field.name === config.fieldMapping.metricField);
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
              geometry: points[i],
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
      .addSelect({
        path: 'queryFormat.locationType',
        name: 'Location source',
        defaultValue: defaultOptions.queryFormat.locationType,
        settings: {
          options: [
            {
              value: 'coordinates',
              label: 'Latitude/Longitude fields',
            },
            {
              value: 'geohash',
              label: 'Geohash field',
            },
          ],
        },
      })
      .addFieldNamePicker({
        path: 'fieldMapping.latitudeField',
        name: 'Latitude Field',
        defaultValue: defaultOptions.fieldMapping.latitudeField,
        settings: {
          filter: (f) => f.type === FieldType.number,
          noFieldsMessage: 'No numeric fields found',
        },
        showIf: (config) =>
          config.queryFormat.locationType === 'coordinates',
      })
      .addFieldNamePicker({
        path: 'fieldMapping.longitudeField',
        name: 'Longitude Field',
        defaultValue: defaultOptions.fieldMapping.longitudeField,
        settings: {
          filter: (f) => f.type === FieldType.number,
          noFieldsMessage: 'No numeric fields found',
        },
        showIf: (config) =>
          config.queryFormat.locationType === 'coordinates',
      })
      .addFieldNamePicker({
        path: 'fieldMapping.geohashField',
        name: 'Geohash Field',
        defaultValue: defaultOptions.fieldMapping.geohashField,
        settings: {
          filter: (f) => f.type === FieldType.string,
          noFieldsMessage: 'No strings fields found',
          info: ({
            name,
            field,
          }) => {
            if(!name || !field) {
              return <div>Select a field that contains <a href="https://en.wikipedia.org/wiki/Geohash">geohash</a> values in each row.</div>
            }
            const first = reduceField({field, reducers:[ReducerID.firstNotNull]})[ReducerID.firstNotNull] as string;
            if(!first) {
              return <div>No values found</div>
            }
            // const coords = decodeGeohash(first);
            // if(coords) {
            //   return <div>First value: {`${coords}`} // {new Date().toISOString()}</div>
            // }
            // return <div>Invalid first value: {`${first}`}</div>;
            return null;
          }
        },
        showIf: (config) =>
          config.queryFormat.locationType === 'geohash',
      })
      .addFieldNamePicker({
        path: 'fieldMapping.metricField',
        name: 'Metric Field',
        defaultValue: defaultOptions.fieldMapping.metricField,
        settings: {
          filter: (f) => f.type === FieldType.number,
          noFieldsMessage: 'No numeric fields found',
        },
      })
      .addNumberInput({
        path: 'minSize',
        description: 'configures the min circle size',
        name: 'Min Size',
        defaultValue: defaultOptions.minSize,
      })
      .addNumberInput({
        path: 'maxSize',
        description: 'configures the max circle size',
        name: 'Max Size',
        defaultValue: defaultOptions.maxSize,
      })
      .addSliderInput({
        path: 'opacity',
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
