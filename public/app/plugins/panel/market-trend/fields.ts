import { ArrayVector, DataFrame, Field, getFieldDisplayName, GrafanaTheme2, outerJoinDataFrames } from '@grafana/data';
import { findField } from 'app/features/dimensions';
import { prepareGraphableFields } from '../timeseries/utils';
import { MarketOptions, CandlestickFieldMap } from './models.gen';

export interface FieldPickerInfo {
  /** property name */
  key: string;

  /** The display name */
  name: string;

  /** by default pick these fields */
  defaults: string[];

  /** How is the field used */
  description: string;
}

interface CandlestickFieldsInfoType {
  open: FieldPickerInfo;
  high: FieldPickerInfo;
  low: FieldPickerInfo;
  close: FieldPickerInfo;
  volume: FieldPickerInfo;
}

export const candlestickFieldsInfo: CandlestickFieldsInfoType = {
  open: {
    key: 'open',
    name: 'Open',
    defaults: ['open', 'o'],
    description: 'The value at the beginning of the period',
  },
  high: {
    key: 'high',
    name: 'High',
    defaults: ['high', 'l'],
    description: 'The maximum value within the period',
  },
  low: {
    key: 'low',
    name: 'Low',
    defaults: ['low', 'l'],
    description: 'The minimum value within the period',
  },
  close: {
    key: 'close',
    name: 'Close',
    defaults: ['close', 'v'],
    description: 'The starting value within time bucket',
  },
  volume: {
    key: 'volume',
    name: 'Volume',
    defaults: ['volume', 'v'],
    description: 'The total value for this whole field',
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
}

function findFieldOrAuto(frame: DataFrame, info: FieldPickerInfo, options: CandlestickFieldMap): Field | undefined {
  const field = findField(frame, (options as any)[info.key]);
  if (!field) {
    for (const field of frame.fields) {
      const name = getFieldDisplayName(field, frame);
      if (info.defaults.includes(name)) {
        return field;
      }
    }
  }
  return field;
}

export function prepareCandlestickFields(
  series: DataFrame[] | undefined,
  theme: GrafanaTheme2,
  options: MarketOptions
): CandlestickData {
  if (!series?.length) {
    return { warn: 'No data' } as CandlestickData;
  }

  // All fields
  const fieldMap = options.fields ?? {};
  const aligned = series.length === 1 ? series[0] : outerJoinDataFrames({ frames: series, enforceSort: true });
  if (!aligned) {
    return { warn: 'No data found' } as CandlestickData;
  }
  const data: CandlestickData = { aligned, frame: aligned };

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
      (data as any)[info.key] = field;
      used.add(field);
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

  if (false) {
    // TODO filter????
  }

  return data;
}
