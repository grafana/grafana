import { DataFrame, Field, FieldType, getFieldDisplayName, GrafanaTheme2 } from '@grafana/data';
import { PanelOptions } from './models.gen';
import { CandlestickFieldMapper, CandlestickFieldMappings, candlestickFields, CandlestickFields } from './types';
import { prepareGraphableFields } from '../timeseries/utils';

// This will return a set of frames with only graphable values included
export function prepareCandlestickFields(
  series: DataFrame[] | undefined,
  theme: GrafanaTheme2,
  options: PanelOptions
): { frames?: DataFrame[]; warn?: string } {
  // do regular time-series prep
  let prepped = prepareGraphableFields(series, theme);

  if (prepped.warn) {
    return prepped;
  }

  // tag fields with state.semanticKind
  const mapper = getCandlestickFieldMapper(options?.names ?? {});

  for (let frame of prepped.frames!) {
    for (const field of frame.fields) {
      field.state!.semanticKind = field.type === FieldType.time ? 'time' : mapper(field, frame);
    }
  }

  return prepped;
}

// Get a field mapper from the configuraiton
export function getCandlestickFieldMapper(mappings: CandlestickFieldMappings): CandlestickFieldMapper {
  const mappers = candlestickFields.map((f) => {
    const name = mappings[f] ?? f;
    return (fname: string, disp: string) => {
      if (name === fname || disp === name) {
        return f;
      }
      return undefined;
    };
  });

  return (field: Field, frame: DataFrame) => {
    for (const mapper of mappers) {
      const disp = getFieldDisplayName(field, frame);
      const v = mapper(field.name, disp);
      if (v) {
        return v;
      }
    }
    return undefined;
  };
}
