import { map } from 'rxjs/operators';

import {
  ArrayVector,
  DataFrame,
  DataTransformerID,
  Field,
  FieldType,
  SynchronousDataTransformerInfo,
} from '@grafana/data';

import { getDistinctLabels } from '../utils';

export interface JoinByLabelsTransformOptions {
  value: string; // something must be defined
  join?: string[];
}

export const joinByLabelsTransformer: SynchronousDataTransformerInfo<JoinByLabelsTransformOptions> = {
  id: DataTransformerID.joinByLabels,
  name: 'Join by labels',
  description: 'Flatten labeled results into a table joined by labels',
  defaultOptions: {},

  operator: (options, ctx) => (source) =>
    source.pipe(map((data) => joinByLabelsTransformer.transformer(options, ctx)(data))),

  transformer: (options: JoinByLabelsTransformOptions) => {
    return (data: DataFrame[]) => {
      if (!data || !data.length) {
        return data;
      }
      return [joinByLabels(options, data)];
    };
  },
};

interface JoinValues {
  keys: string[];
  values: Record<string, number[]>;
}

export function joinByLabels(options: JoinByLabelsTransformOptions, data: DataFrame[]): DataFrame {
  if (!options.value?.length) {
    return getErrorFrame('No value labele configured');
  }
  const distinctLabels = getDistinctLabels(data);
  if (distinctLabels.size < 1) {
    return getErrorFrame('No labels in result');
  }
  if (!distinctLabels.has(options.value)) {
    return getErrorFrame('Value label not found');
  }

  let join = options.join?.length ? options.join : Array.from(distinctLabels);
  join = join.filter((f) => f !== options.value);

  const names = new Set<string>();
  const found = new Map<string, JoinValues>();
  const inputFields: Record<string, Field> = {};
  for (const frame of data) {
    for (const field of frame.fields) {
      if (field.labels && field.type !== FieldType.time) {
        const keys = join.map((v) => field.labels![v]);
        const key = keys.join(',');
        let item = found.get(key);
        if (!item) {
          item = {
            keys,
            values: {},
          };
          found.set(key, item);
        }
        const name = field.labels[options.value];
        const vals = field.values.toArray();
        const old = item.values[name];
        if (old) {
          item.values[name] = old.concat(vals);
        } else {
          item.values[name] = vals;
        }
        if (!inputFields[name]) {
          inputFields[name] = field; // keep the config
        }
        names.add(name);
      }
    }
  }

  const allNames = Array.from(names);
  const joinValues = join.map((): string[] => []);
  const nameValues = allNames.map((): number[] => []);

  for (const item of found.values()) {
    let valueOffset = -1;
    let done = false;
    while (!done) {
      valueOffset++;
      done = true;
      for (let i = 0; i < join.length; i++) {
        joinValues[i].push(item.keys[i]);
      }
      for (let i = 0; i < allNames.length; i++) {
        const name = allNames[i];
        const values = item.values[name] ?? [];
        nameValues[i].push(values[valueOffset]);
        if (values.length > valueOffset + 1) {
          done = false;
        }
      }
    }
  }

  const frame: DataFrame = { fields: [], length: nameValues[0].length };
  for (let i = 0; i < join.length; i++) {
    frame.fields.push({
      name: join[i],
      config: {},
      type: FieldType.string,
      values: new ArrayVector(joinValues[i]),
    });
  }

  for (let i = 0; i < allNames.length; i++) {
    const old = inputFields[allNames[i]];
    frame.fields.push({
      name: allNames[i],
      config: {},
      type: old.type ?? FieldType.number,
      values: new ArrayVector(nameValues[i]),
    });
  }

  return frame;
}

function getErrorFrame(text: string): DataFrame {
  return {
    meta: {
      notices: [{ severity: 'error', text }],
    },
    fields: [{ name: 'Error', type: FieldType.string, config: {}, values: new ArrayVector([text]) }],
    length: 0,
  };
}
