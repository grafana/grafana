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
  description: 'Use a field value to lookup countries, states, or airports.',
  defaultOptions: {},

  operator: (options) => (source) => source.pipe(mergeMap((data) => from(doGazetteerXform(data, options)))),
};

async function doGazetteerXform(frames: DataFrame[], options: FieldLookupOptions): Promise<DataFrame[]> {
  const fieldMatches = fieldMatchers.get(FieldMatcherID.byName).get(options?.lookupField);

  const gazetteer = await getGazetteer(options?.gazetteer ?? COUNTRIES_GAZETTEER_PATH);

  if (!gazetteer.frame) {
    return Promise.reject('missing frame in gazetteer');
  }

  return addFieldsFromGazetteer(frames, gazetteer, fieldMatches);
}

export function addFieldsFromGazetteer(frames: DataFrame[], gazetteer: Gazetteer, matcher: FieldMatcher): DataFrame[] {
  const gazetteerFields = gazetteer.frame!()?.fields;

  if (!gazetteerFields) {
    return frames;
  }

  return frames.map((frame) => {
    const frameLength = frame.length;
    const fields: Field[] = [];

    for (const field of frame.fields) {
      fields.push(field);

      if (matcher(field, frame, frames)) {
        const values = field.values;
        const gazetteerFieldValuesBuffer: unknown[][] = [];

        for (const gazetteerField of gazetteerFields) {
          const buffer = new Array(frameLength);
          gazetteerFieldValuesBuffer.push(buffer);
          fields.push({ ...gazetteerField, values: buffer });
        }

        for (let valueIndex = 0; valueIndex < gazetteer.count!; valueIndex++) {
          const foundValue = gazetteer.find(values[valueIndex]);

          if (foundValue?.index != null) {
            for (let fieldIndex = 0; fieldIndex < gazetteerFields.length; fieldIndex++) {
              gazetteerFieldValuesBuffer[fieldIndex][valueIndex] = gazetteerFields[fieldIndex].values[foundValue.index];
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
