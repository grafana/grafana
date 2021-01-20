import { DataFrame, Field, FieldMatcher, FieldType } from '../../types';
import { ArrayVector } from '../../vector';
import { fieldMatchers } from '../matchers';
import { FieldMatcherID } from '../matchers/ids';
import uPlot, { AlignedData } from 'uplot';
import { getTimeField } from '../../dataframe';

export function pickBestJoinField(data: DataFrame[]): FieldMatcher {
  const { timeField } = getTimeField(data[0]);
  if (timeField) {
    return fieldMatchers.get(FieldMatcherID.firstTimeField).get({});
  }
  let common: string[] = [];
  for (const f of data[0].fields) {
    if (f.type === FieldType.number) {
      common.push(f.name);
    }
  }

  for (let i = 1; i < data.length; i++) {
    const names: string[] = [];
    for (const f of data[0].fields) {
      if (f.type === FieldType.number) {
        names.push(f.name);
      }
    }
    common = common.filter(v => !names.includes(v));
  }

  return fieldMatchers.get(FieldMatcherID.byName).get(common[0]);
}

/**
 * This will return a single frame joined by the first matching field.  When a join field is not specified,
 * the default will use the first time field
 */
export function alignDataFrames(data: DataFrame[], joinFieldMatcher?: FieldMatcher): DataFrame | undefined {
  if (data.length < 2) {
    return data[0];
  }

  const allData: AlignedData[] = [];
  const originalFields: Field[] = [];

  joinFieldMatcher = joinFieldMatcher ?? pickBestJoinField(data);
  for (const frame of data) {
    let join: Field | undefined = undefined;
    let fields: Field[] = [];
    for (const field of frame.fields) {
      if (!join && joinFieldMatcher(field, frame, data)) {
        join = field;
      } else {
        fields.push(field);
      }
    }

    if (!join) {
      continue; // error?
    }

    if (originalFields.length < 1) {
      originalFields.push(join); // first join field
    }

    const a: AlignedData = [join.values.toArray()]; //
    for (const field of fields) {
      a.push(field.values.toArray());
      originalFields.push(field);
    }
    allData.push(a);
  }

  const joined = uPlot.join(allData).data;
  if (!joined) {
    return undefined;
  }

  return {
    ...data[0],
    fields: originalFields.map((f, index) => ({
      ...f,
      values: new ArrayVector(joined[index]),
    })),
  };
}
