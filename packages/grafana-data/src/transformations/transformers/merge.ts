import { DataTransformerID } from './ids';
import { DataTransformerInfo } from '../../types/transformations';
import { DataFrame, Field, FieldType } from '../../types/dataFrame';
import { omit } from 'lodash';
import { ArrayVector } from '../../vector/ArrayVector';
import { MutableDataFrame, sortDataFrame } from '../../dataframe';

type MergeDetailsKeyFactory = (existing: Record<string, any>, value: Record<string, any>) => string;

export interface MergeTransformerOptions {}

export const mergeTransformer: DataTransformerInfo<MergeTransformerOptions> = {
  id: DataTransformerID.merge,
  name: 'Merge series/tables',
  description: 'Merges multiple series/tables into a single serie/table',
  defaultOptions: {},
  transformer: (options: MergeTransformerOptions) => {
    return (data: DataFrame[]) => {
      if (!Array.isArray(data) || data.length <= 1) {
        return data;
      }

      const fieldByName = new Set<string>();
      const fieldIndexByName: Record<string, Record<number, number>> = {};
      const fieldNamesForKey: string[] = [];
      const dataFrame = new MutableDataFrame();

      for (let frameIndex = 0; frameIndex < data.length; frameIndex++) {
        const frame = data[frameIndex];

        for (let fieldIndex = 0; fieldIndex < frame.fields.length; fieldIndex++) {
          const field = frame.fields[fieldIndex];

          if (!fieldByName.has(field.name)) {
            dataFrame.addField(copyFieldStructure(field));
            fieldByName.add(field.name);
          }

          fieldIndexByName[field.name] = fieldIndexByName[field.name] || {};
          fieldIndexByName[field.name][frameIndex] = fieldIndex;

          if (data.length - 1 !== frameIndex) {
            continue;
          }

          if (Object.keys(fieldIndexByName[field.name]).length === data.length) {
            fieldNamesForKey.push(field.name);
          }
        }
      }

      if (fieldNamesForKey.length === 0) {
        return data;
      }

      const dataFrameIndexByKey: Record<string, number> = {};
      const keyFactory = createKeyFactory(data, fieldIndexByName, fieldNamesForKey);
      const detailsKeyFactory = createDetailsKeyFactory(fieldByName, fieldNamesForKey);
      const valueMapper = createValueMapper(data, fieldByName, fieldIndexByName);

      for (let frameIndex = 0; frameIndex < data.length; frameIndex++) {
        const frame = data[frameIndex];

        for (let valueIndex = 0; valueIndex < frame.length; valueIndex++) {
          const key = keyFactory(frameIndex, valueIndex);
          const value = valueMapper(frameIndex, valueIndex);
          mergeOrAdd(key, value, dataFrame, dataFrameIndexByKey, detailsKeyFactory);
        }
      }

      const timeIndex = dataFrame.fields.findIndex(field => field.type === FieldType.time);
      if (typeof timeIndex === 'number') {
        return [sortDataFrame(dataFrame, timeIndex, true)];
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

const createDetailsKeyFactory = (fieldByName: Set<string>, fieldNamesForKey: string[]): MergeDetailsKeyFactory => {
  const fieldNamesToExclude = fieldNamesForKey.reduce((exclude: Record<string, boolean>, fieldName: string) => {
    exclude[fieldName] = true;
    return exclude;
  }, {});

  const checkOrder = Array.from(fieldByName).filter(fieldName => !fieldNamesToExclude[fieldName]);

  return (existing: Record<string, any>, value: Record<string, any>) => {
    return checkOrder.reduce((key: string, fieldName: string) => {
      if (typeof existing[fieldName] === 'undefined') {
        return key;
      }
      if (typeof value[fieldName] === 'undefined') {
        return key;
      }
      if (existing[fieldName] === value[fieldName]) {
        return key;
      }
      return key + value[fieldName];
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

const mergeOrAdd = (
  key: string,
  value: Record<string, any>,
  dataFrame: MutableDataFrame,
  dataFrameIndexByKey: Record<string, number>,
  detailsKeyFactory: MergeDetailsKeyFactory
) => {
  if (typeof dataFrameIndexByKey[key] === 'undefined') {
    dataFrame.add(value);
    dataFrameIndexByKey[key] = dataFrame.length - 1;
    return;
  }

  const dataFrameIndex = dataFrameIndexByKey[key];
  const existing = dataFrame.get(dataFrameIndex);

  if (isMergable(existing, value)) {
    const merged = { ...existing, ...value };
    dataFrame.set(dataFrameIndex, merged);
    return;
  }

  const nextKey = key + detailsKeyFactory(existing, value);
  mergeOrAdd(nextKey, value, dataFrame, dataFrameIndexByKey, detailsKeyFactory);
};
