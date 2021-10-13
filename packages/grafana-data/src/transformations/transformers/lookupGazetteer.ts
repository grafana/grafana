import { map } from 'rxjs';
import { FieldMatcherID, fieldMatchers } from '..';
import { ArrayVector, DataFrame, FieldType, SynchronousDataTransformerInfo } from '../..';
import { DataTransformerID } from './ids';

export interface LookupGazetteerOptions {
  mappingField?: string;
  lookupField?: string;
}

export const lookupGazetteerTransformer: SynchronousDataTransformerInfo<LookupGazetteerOptions> = {
  id: DataTransformerID.lookupGazetteer,
  name: 'Lookup fields from gazetteer',
  description: 'Retrieve matching data based on specified field',
  defaultOptions: {},

  operator: (options) => (source) => source.pipe(map((data) => lookupGazetteerTransformer.transformer(options)(data))),

  transformer: (options: LookupGazetteerOptions) => (data: DataFrame[]) => {
    if (!Array.isArray(data) || data.length === 0) {
      return data;
    }

    return addFieldsFromGazetteer(data, options);
  },
};

export const addFieldsFromGazetteer = (frames: DataFrame[], options: LookupGazetteerOptions): DataFrame[] => {
  const framesCopy = frames.map((frame) => ({ ...frame }));

  if (!options.lookupField || !options.mappingField) {
    return frames;
  }

  const fieldMatches = fieldMatchers.get(FieldMatcherID.byName).get(options.mappingField);

  framesCopy.map((frame) => {
    for (const field of frame.fields) {
      if (fieldMatches(field, frame, framesCopy)) {
        const values = field.values.toArray();
        const newField = [];
        for (let v = 0; v < values.length; v++) {
          const foundMatchingValue = SAMPLE_STATES.features.find((item) => item.id === values[v]);
          if (foundMatchingValue) {
            newField.push(foundMatchingValue.geometry);
          } else {
            newField.push(null);
          }
        }
        frame.fields.push({ name: 'matched', type: FieldType.string, values: new ArrayVector(newField), config: {} });
      }
    }
    return frame;
  });

  console.log('copy', framesCopy);
  return framesCopy;
};

const SAMPLE_STATES = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'AL',
      properties: { name: 'Alabama', density: 94.65 },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-87.359296, 35.00118],
            [-85.606675, 34.984749],
            [-85.431413, 34.124869],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      id: 'AK',
      properties: { name: 'Alaska', density: 1.264 },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [-131.602021, 55.117982],
              [-131.569159, 55.28229],
              [-131.355558, 55.183705],
            ],
          ],
          [
            [
              [-131.832052, 55.42469],
              [-131.645836, 55.304197],
              [-131.749898, 55.128935],
            ],
          ],
          [
            [
              [-132.976733, 56.437924],
              [-132.735747, 56.459832],
              [-132.631685, 56.421493],
            ],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      id: 'AZ',
      properties: { name: 'Arizona', density: 57.05 },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-109.042503, 37.000263],
            [-109.04798, 31.331629],
          ],
        ],
      },
    },
  ],
};
