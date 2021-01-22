import { DataFrame, Field, FieldMatcher, FieldType } from '../../types';
import { ArrayVector } from '../../vector';
import { fieldMatchers } from '../matchers';
import { FieldMatcherID } from '../matchers/ids';
import uPlot, { AlignedData, JoinNullMode } from 'uplot';
import { getTimeField } from '../../dataframe';
import { getFieldDisplayName } from '../../field';

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
    common = common.filter((v) => !names.includes(v));
  }

  return fieldMatchers.get(FieldMatcherID.byName).get(common[0]);
}

export interface JoinOptions {
  data: DataFrame[];
  joinBy?: FieldMatcher;
}

/**
 * This will return a single frame joined by the first matching field.  When a join field is not specified,
 * the default will use the first time field
 */
export function alignDataFrames(options: JoinOptions): DataFrame | undefined {
  if (!options.data.length) {
    return undefined;
  }
  if (options.data.length < 2) {
    return options.data[0];
  }

  const allData: AlignedData[] = [];
  const originalFields: Field[] = [];

  const joinFieldMatcher = options.joinBy ?? pickBestJoinField(options.data);
  for (const frame of options.data) {
    let join: Field | undefined = undefined;
    let fields: Field[] = [];
    for (const field of frame.fields) {
      getFieldDisplayName(field, frame, options.data); // caches the name (with frames) in state

      if (!join && joinFieldMatcher(field, frame, options.data)) {
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

  const joined = uPlot.join(
    allData,
    allData.map((v) => v.map((x) => JoinNullMode.Expand)) // will show gaps in the timeseries panel
  );
  if (!joined) {
    return undefined;
  }

  return {
    ...options.data[0],
    fields: originalFields.map((f, index) => ({
      ...f,
      values: new ArrayVector(joined[index]),
    })),
  };
}
