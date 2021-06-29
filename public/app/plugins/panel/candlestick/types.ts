import { DataFrame, Field } from '@grafana/data';

export enum CandlestickFieldID {
  Open = 'open',
  High = 'high',
  Low = 'low',
  Close = 'close',
  Volume = 'volume',
}

export const candlestickFields = [
  CandlestickFieldID.Open,
  CandlestickFieldID.High,
  CandlestickFieldID.Low,
  CandlestickFieldID.Close,
  CandlestickFieldID.Volume,
];

export type CandlestickFieldMappings = Partial<Record<CandlestickFieldID, string>>;
export type CandlestickFieldMapper = (field: Field, frame: DataFrame) => CandlestickFieldID | undefined;

export interface CandlestickFields {
  warning?: string;

  // Everythign shares a time field
  time: Field;

  // OHLC all share same units
  [CandlestickFieldID.Open]?: Field;
  [CandlestickFieldID.High]?: Field;
  [CandlestickFieldID.Low]?: Field;
  [CandlestickFieldID.Close]?: Field;
  [CandlestickFieldID.Volume]?: Field;

  // Additional fields
  series: Field[];
}
