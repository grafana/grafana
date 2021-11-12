import {
  ArrayVector,
  DataFrame,
  Field,
  FieldType,
  getFieldDisplayName,
  GrafanaTheme2,
  outerJoinDataFrames,
} from '@grafana/data';
import { findField } from 'app/features/dimensions';
import { prepareGraphableFields } from '../timeseries/utils';
import { MarketOptions, CandlestickFieldMap } from './models.gen';

export interface FieldPickerInfo {
  /** property name */
  key: keyof CandlestickFieldMap;

  /** The display name */
  name: string;

  /** by default pick these fields */
  defaults: string[];

  /** How is the field used */
  description: string;
}

export const candlestickFieldsInfo: Record<keyof CandlestickFieldMap, FieldPickerInfo> = {
  open: {
    key: 'open',
    name: 'Open',
    defaults: ['open', 'o'],
    description: 'The value at the beginning of the period',
  },
  high: {
    key: 'high',
    name: 'High',
    defaults: ['high', 'h', 'max'],
    description: 'The maximum value within the period',
  },
  low: {
    key: 'low',
    name: 'Low',
    defaults: ['low', 'l', 'min'],
    description: 'The minimum value within the period',
  },
  close: {
    key: 'close',
    name: 'Close',
    defaults: ['close', 'c'],
    description: 'The value at the end of the measured period',
  },
  volume: {
    key: 'volume',
    name: 'Volume',
    defaults: ['volume', 'v'],
    description: 'Activity within the measured period',
  },
};

export interface CandlestickData {
  warn?: string;
  noTimeField?: boolean;

  // Special fields
  open?: Field;
  high?: Field;
  low?: Field;
  close?: Field;
  volume?: Field;

  // All incoming values
  aligned: DataFrame;

  // The stuff passed to GraphNG
  frame: DataFrame;

  // The real names used
  names: CandlestickFieldMap;
}

function findFieldOrAuto(frame: DataFrame, info: FieldPickerInfo, options: CandlestickFieldMap): Field | undefined {
  const field = findField(frame, options[info.key]);
  if (!field) {
    for (const field of frame.fields) {
      const name = getFieldDisplayName(field, frame).toLowerCase();
      if (info.defaults.includes(name) || info.defaults.includes(field.name)) {
        return field;
      }
    }
  }
  return field;
}

export function prepareCandlestickFields(
  series: DataFrame[] | undefined,
  options: MarketOptions,
  theme: GrafanaTheme2
): CandlestickData {
  if (!series?.length) {
    return { warn: 'No data' } as CandlestickData;
  }

  // All fields
  const fieldMap = options.fields ?? {};
  const aligned = series.length === 1 ? series[0] : outerJoinDataFrames({ frames: series, enforceSort: true });
  if (!aligned?.length) {
    return { warn: 'No data found' } as CandlestickData;
  }
  const data: CandlestickData = { aligned, frame: aligned, names: {} };

  // Apply same filter as everythign else in timeseries
  const norm = prepareGraphableFields([aligned], theme);
  if (norm.warn || norm.noTimeField || !norm.frames?.length) {
    return norm as CandlestickData;
  }
  data.frame = norm.frames[0];

  // Find the known fields
  const used = new Set<Field>();
  for (const info of Object.values(candlestickFieldsInfo)) {
    const field = findFieldOrAuto(data.frame, info, fieldMap);
    if (field) {
      data[info.key] = field;
      used.add(field);
    }
  }

  // Use first numeric value as open
  if (!data.open && !data.close) {
    data.open = data.frame.fields.find((f) => f.type === FieldType.number);
    if (data.open) {
      used.add(data.open);
    }
  }

  // Use next open as 'close' value
  if (data.open && !data.close && !fieldMap.close) {
    const values = data.open.values.toArray().slice(1);
    values.push(values[values.length - 1]); // duplicate last value
    data.close = {
      ...data.open,
      values: new ArrayVector(values),
      name: 'Next open',
      state: undefined,
    };
    data.frame.fields.push(data.close);
  }

  // Use previous close as 'open' value
  if (data.close && !data.open && !fieldMap.open) {
    const values = data.close.values.toArray().slice();
    values.unshift(values[0]); // duplicate first value
    values.length = data.frame.length;
    data.open = {
      ...data.close,
      values: new ArrayVector(values),
      name: 'Previous close',
      state: undefined,
    };
    data.frame.fields.push(data.open);
  }

  // Use the open field for min/max if nothing is set
  if (!data.high && !fieldMap.high) {
    data.high = data.open;
  }
  if (!data.low && !fieldMap.low) {
    data.low = data.open;
  }

  // Register the name of each mapped field
  for (const info of Object.values(candlestickFieldsInfo)) {
    const f = data[info.key];
    if (f) {
      data.names[info.key] = getFieldDisplayName(f, data.frame);
    }
  }

  return data;
}
