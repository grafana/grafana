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

export const semanticFields = [...candlestickFields];

export type CandlestickFieldMappings = Partial<Record<CandlestickFieldID, string>>;

export type SemanticFieldsMapper = (field: Field, frame: DataFrame) => CandlestickFieldID | undefined;
