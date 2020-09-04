import { DataTransformerID } from './ids';
import { DataTransformerInfo } from '../../types/transformations';
import { DataFrame, Field } from '../../types/dataFrame';
import { omit } from 'lodash';
import { ArrayVector } from '../../vector/ArrayVector';
import { MutableDataFrame } from '../../dataframe';

interface ValuePointer {
  key: string;
  index: number;
}

export interface MergeTransformerOptions {}

export const mergeTransformer: DataTransformerInfo<MergeTransformerOptions> = {
  id: DataTransformerID.merge,
  name: 'Merge series/tables',
  description: 'Merges multiple series/tables into a single serie/table',
  defaultOptions: {},
  transformer: (options: MergeTransformerOptions) => {
    return (dataFrames: DataFrame[]) => {
      if (!Array.isArray(dataFrames) || dataFrames.length === 0) {
        return dataFrames;
      }

      const data = dataFrames.filter(frame => frame.fields.length > 0);

      if (data.length === 0) {
        return [dataFrames[0]];
      }

      const fieldNames = new Set<string>();
      const fieldIndexByName: Record<string, Record<number, number>> = {};
      const fieldNamesForKey: string[] = [];
      const dataFrame = new MutableDataFrame();

      for (let frameIndex = 0; frameIndex < data.length; frameIndex++) {
        const frame = data[frameIndex];

        for (let fieldIndex = 0; fieldIndex < frame.fields.length; fieldIndex++) {
          const field = frame.fields[fieldIndex];

          if (!fieldNames.has(field.name)) {
            dataFrame.addField(copyFieldStructure(field));
            fieldNames.add(field.name);
          }

          fieldIndexByName[field.name] = fieldIndexByName[field.name] || {};
          fieldIndexByName[field.name][frameIndex] = fieldIndex;

          if (data.length - 1 !== frameIndex) {
            continue;
          }

          if (fieldExistsInAllFrames(fieldIndexByName, field, data)) {
            fieldNamesForKey.push(field.name);
          }
        }
      }

      if (fieldNamesForKey.length === 0) {
        return dataFrames;
      }

      const valuesByKey: Record<string, Array<Record<string, any>>> = {};
      const valuesInOrder: ValuePointer[] = [];
      const keyFactory = createKeyFactory(data, fieldIndexByName, fieldNamesForKey);
      const valueMapper = createValueMapper(data, fieldNames, fieldIndexByName);

      for (let frameIndex = 0; frameIndex < data.length; frameIndex++) {
        const frame = data[frameIndex];

        for (let valueIndex = 0; valueIndex < frame.length; valueIndex++) {
          const key = keyFactory(frameIndex, valueIndex);
          const value = valueMapper(frameIndex, valueIndex);

          if (!Array.isArray(valuesByKey[key])) {
            valuesByKey[key] = [value];
            valuesInOrder.push(createPointer(key, valuesByKey));
            continue;
          }

          let valueWasMerged = false;

          valuesByKey[key] = valuesByKey[key].map(existing => {
            if (!isMergable(existing, value)) {
              return existing;
            }
            valueWasMerged = true;
            return { ...existing, ...value };
          });

          if (!valueWasMerged) {
            valuesByKey[key].push(value);
            valuesInOrder.push(createPointer(key, valuesByKey));
          }
        }
      }

      for (const pointer of valuesInOrder) {
        const value = valuesByKey[pointer.key][pointer.index];

        if (value) {
          dataFrame.add(value, false);
        }
      }

      return [dataFrame];
    };
  },
};

const copyFieldStructure = (field: Field): Field => {
  return {
    ...omit(field, ['values', 'state', 'labels', 'config']),
    values: new ArrayVector(),
    config: {
      ...omit(field.config, 'displayName'),
    },
  };
};

const createKeyFactory = (
  data: DataFrame[],
  fieldPointerByName: Record<string, Record<string, number>>,
  keyFieldNames: string[]
) => {
  const factoryIndex = keyFieldNames.reduce((index: Record<string, number[]>, fieldName) => {
    return Object.keys(fieldPointerByName[fieldName]).reduce((index: Record<string, number[]>, frameIndex) => {
      index[frameIndex] = index[frameIndex] || [];
      index[frameIndex].push(fieldPointerByName[fieldName][frameIndex]);
      return index;
    }, index);
  }, {});

  return (frameIndex: number, valueIndex: number): string => {
    return factoryIndex[frameIndex].reduce((key: string, fieldIndex: number) => {
      return key + data[frameIndex].fields[fieldIndex].values.get(valueIndex);
    }, '');
  };
};

const createValueMapper = (
  data: DataFrame[],
  fieldByName: Set<string>,
  fieldIndexByName: Record<string, Record<number, number>>
) => {
  return (frameIndex: number, valueIndex: number) => {
    const value: Record<string, any> = {};
    const fieldNames = Array.from(fieldByName);

    for (const fieldName of fieldNames) {
      const fieldIndexByFrameIndex = fieldIndexByName[fieldName];
      if (!fieldIndexByFrameIndex) {
        continue;
      }

      const fieldIndex = fieldIndexByFrameIndex[frameIndex];
      if (typeof fieldIndex !== 'number') {
        continue;
      }

      const frame = data[frameIndex];
      if (!frame || !frame.fields) {
        continue;
      }

      const field = frame.fields[fieldIndex];
      if (!field || !field.values) {
        continue;
      }

      value[fieldName] = field.values.get(valueIndex);
    }

    return value;
  };
};

const isMergable = (existing: Record<string, any>, value: Record<string, any>): boolean => {
  let mergable = true;

  for (const prop in value) {
    if (typeof existing[prop] === 'undefined') {
      continue;
    }

    if (existing[prop] === null) {
      continue;
    }

    if (existing[prop] !== value[prop]) {
      mergable = false;
      break;
    }
  }

  return mergable;
};

const fieldExistsInAllFrames = (
  fieldIndexByName: Record<string, Record<number, number>>,
  field: Field,
  data: DataFrame[]
) => {
  return Object.keys(fieldIndexByName[field.name]).length === data.length;
};

const createPointer = (key: string, valuesByKey: Record<string, Array<Record<string, any>>>): ValuePointer => {
  return {
    key,
    index: valuesByKey[key].length - 1,
  };
};
