import { mergeMap, from } from 'rxjs';

import {
  DataFrame,
  DataTransformerID,
  Field,
  FieldMatcher,
  FieldMatcherID,
  fieldMatchers,
  DataTransformerInfo,
} from '@grafana/data';
import { COUNTRIES_GAZETTEER_PATH, Gazetteer, getGazetteer } from 'app/features/geo/gazetteer/gazetteer';

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
    return Promise.reject('missing frame in gazetteer');
  }

  return addFieldsFromGazetteer(frames, gaz, fieldMatches);
}

export function addFieldsFromGazetteer(frames: DataFrame[], gaz: Gazetteer, matcher: FieldMatcher): DataFrame[] {
  const src = gaz.frame!()?.fields;
  if (!src) {
    return frames;
  }

  return frames.map((frame) => {
    const length = frame.length;
    const fields: Field[] = [];

    for (const field of frame.fields) {
      fields.push(field);

      //if the field matches
      if (matcher(field, frame, frames)) {
        const values = field.values;
        const sub: any[][] = [];
        for (const f of src) {
          const buffer = new Array(length);
          sub.push(buffer);
          fields.push({ ...f, values: buffer });
        }

        // Add all values to the buffer
        for (let v = 0; v < sub.length; v++) {
          const found = gaz.find(values[v]);
          if (found?.index != null) {
            for (let i = 0; i < src.length; i++) {
              sub[i][v] = src[i].values.get(found.index);
            }
          }
        }
      }
    }
    return {
      ...frame,
      fields,
    };
  });
}
