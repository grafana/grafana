import { DataFrame, FieldType, Field, Vector } from '../types';

import {
  Table,
  ArrowType,
  Builder,
  Vector as ArrowVector,
  Float64,
  DataType,
  Utf8,
  TimestampMillisecond,
  Bool,
  Column,
} from 'apache-arrow';

export interface ArrowDataFrame extends DataFrame {
  table: Table;
}

export function base64StringToArrowTable(text: string): Table {
  const b64 = atob(text);
  const arr = Uint8Array.from(b64, c => {
    return c.charCodeAt(0);
  });
  return Table.from(arr);
}

function valueOrUndefined(val?: string) {
  return val ? val : undefined;
}

function parseOptionalMeta(str?: string): any {
  if (str && str.length && str !== '{}') {
    try {
      return JSON.parse(str);
    } catch (err) {
      console.warn('Error reading JSON from arrow metadata: ', str);
    }
  }
  return undefined;
}

export function arrowTableToDataFrame(table: Table): ArrowDataFrame {
  const fields: Field[] = [];

  for (let i = 0; i < table.numCols; i++) {
    const col = table.getColumnAt(i);
    if (col) {
      const schema = table.schema.fields[i];
      let type = FieldType.other;
      const values: Vector<any> = col;
      switch ((schema.typeId as unknown) as ArrowType) {
        case ArrowType.Decimal:
        case ArrowType.Int:
        case ArrowType.FloatingPoint: {
          type = FieldType.number;
          break;
        }
        case ArrowType.Bool: {
          type = FieldType.boolean;
          break;
        }
        case ArrowType.Timestamp: {
          type = FieldType.time;
          break;
        }
        case ArrowType.Utf8: {
          type = FieldType.string;
          break;
        }
        default:
          console.log('UNKNOWN Type:', schema);
      }

      fields.push({
        name: stripFieldNamePrefix(col.name),
        type,
        values,
        config: parseOptionalMeta(col.metadata.get('config')) || {},
        labels: parseOptionalMeta(col.metadata.get('labels')),
      });
    }
  }
  const meta = table.schema.metadata;
  return {
    fields,
    length: table.length,
    refId: valueOrUndefined(meta.get('refId')),
    name: valueOrUndefined(meta.get('name')),
    meta: parseOptionalMeta(meta.get('meta')),
    table,
  };
}

// fieldNamePrefixSep is the delimiter used with fieldNamePrefix.
const fieldNamePrefixSep = '🦥: ';

function stripFieldNamePrefix(name: string): string {
  const idx = name.indexOf(fieldNamePrefixSep);
  if (idx > 0) {
    return name.substring(idx + fieldNamePrefixSep.length);
  }
  return name;
}

function toArrowVector(field: Field): ArrowVector {
  // OR: Float64Vector.from([1, 2, 3]));

  let type: DataType;
  if (field.type === FieldType.number) {
    type = new Float64();
  } else if (field.type === FieldType.time) {
    type = new TimestampMillisecond();
  } else if (field.type === FieldType.boolean) {
    type = new Bool();
  } else if (field.type === FieldType.string) {
    type = new Utf8();
  } else {
    type = new Utf8();
  }
  const builder = Builder.new({ type, nullValues: [null] });
  field.values.toArray().forEach(builder.append.bind(builder));
  return builder.finish().toVector();
}

export function grafanaDataFrameToArrowTable(data: DataFrame): Table {
  // Return the original table
  let table = (data as any).table;
  if (table instanceof Table) {
    return table as Table;
  }
  // Make sure the names are unique
  const names = new Set<string>();

  table = Table.new(
    data.fields.map((field, index) => {
      let name = field.name;
      if (names.has(field.name)) {
        name = `${index}${fieldNamePrefixSep}${field.name}`;
      }
      names.add(name);
      const column = Column.new(name, toArrowVector(field));
      if (field.labels) {
        column.metadata.set('labels', JSON.stringify(field.labels));
      }
      if (field.config) {
        column.metadata.set('config', JSON.stringify(field.config));
      }
      return column;
    })
  );
  const metadata = table.schema.metadata;
  if (data.name) {
    metadata.set('name', data.name);
  }
  if (data.refId) {
    metadata.set('refId', data.refId);
  }
  if (data.meta) {
    metadata.set('meta', JSON.stringify(data.meta));
  }
  return table;
}
