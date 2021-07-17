import { DataFrame, Field, FieldType, getFieldDisplayName } from '@grafana/data';
import { PanelOptions } from './models.gen';
import { CandlestickFieldMapper, CandlestickFieldMappings, candlestickFields, CandlestickFields } from './types';

// This will return a set of frames with only graphable values included
export function prepareCandlestickFields(series: DataFrame[] | undefined, options: PanelOptions): CandlestickFields {
  const fields: CandlestickFields = ({ series: [] } as unknown) as CandlestickFields;
  if (!series?.length) {
    fields.warning = 'No data in response';
    return fields;
  }
  if (series.length > 1) {
    fields.warning = 'Currently we only support a single frame';
    return fields;
  }

  // Setup the name picker
  const mapper = getCandlestickFieldMapper(options?.names ?? {});

  for (let frame of series) {
    for (const field of frame.fields) {
      switch (field.type) {
        case FieldType.time:
          if (fields.time) {
            fields.warning = 'duplicate time fields found';
            return fields;
          }
          fields.time = field;
          break;

        case FieldType.number:
          const f = mapper(field, frame);
          if (f != null) {
            if (fields[f]) {
              fields.warning = 'duplicate fields found for: ' + f;
            }
            fields[f] = field;
            break;
          }

        default:
          fields.series.push(field);
      }
    }
  }

  if (!fields.time) {
    fields.warning = 'Data does not have a time field';
  }
  return fields;
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
