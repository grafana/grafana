import {
  ArrayVector,
  DataFrame,
  DataTransformerID,
  Field,
  FieldMatcher,
  FieldMatcherID,
  fieldMatchers,
  FieldType,
  DataTransformerInfo,
} from '@grafana/data';
import { COUNTRIES_GAZETTEER_PATH, Gazetteer, getGazetteer } from 'app/features/geo/gazetteer/gazetteer';
import { mergeMap, from } from 'rxjs';

export interface FieldLookupOptions {
  lookupField?: string;
  gazetteer?: string;
}

export const fieldLookupTransformer: DataTransformerInfo<FieldLookupOptions> = {
  id: DataTransformerID.fieldLookup,
  name: 'Lookup fields from resource',
  description: 'Retrieve matching data based on specified field',
  defaultOptions: {},

  operator: (options) => (source) => source.pipe(mergeMap((data) => from(doGazetteerXform(data, options)))),
};

async function doGazetteerXform(frames: DataFrame[], options: FieldLookupOptions): Promise<DataFrame[]> {
  const fieldMatches = fieldMatchers.get(FieldMatcherID.byName).get(options?.lookupField);

  const gaz = await getGazetteer(options?.gazetteer ?? COUNTRIES_GAZETTEER_PATH);

  if (!gaz.frame) {
    return Promise.reject('missng frame in gazeeteer');
  }

  return addFieldsFromGazetteer(frames, gaz, fieldMatches);
}

export function addFieldsFromGazetteer(frames: DataFrame[], gaz: Gazetteer, matcher: FieldMatcher): DataFrame[] {
  return frames.map((frame) => {
    const fields: Field[] = [];

    for (const field of frame.fields) {
      fields.push(field);

      //if the field matches
      if (matcher(field, frame, frames)) {
        const values = field.values.toArray();
        const lat = new Array<Number>(values.length);
        const lon = new Array<Number>(values.length);

        //for each value find the corresponding value in the gazetteer
        for (let v = 0; v < values.length; v++) {
          const found = gaz.find(values[v]);
          if (found?.index != null) {
            // TODO -- add the additional field metadata
          }
        }
        fields.push({ name: 'lon', type: FieldType.number, values: new ArrayVector(lon), config: {} });
        fields.push({ name: 'lat', type: FieldType.number, values: new ArrayVector(lat), config: {} });
      }
    }
    return {
      ...frame,
      fields,
    };
  });
}
