import { DataFrame, FieldType, Field, Vector } from '../types';
import { FunctionalVector } from '../vector/FunctionalVector';

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
import { getFieldDisplayName } from '../field';

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
      let values: Vector<any> = col;
      switch ((schema.typeId as unknown) as ArrowType) {
        case ArrowType.Decimal:
        case ArrowType.FloatingPoint: {
          type = FieldType.number;
          break;
        }
        case ArrowType.Int: {
          type = FieldType.number;
          values = new NumberColumn(col); // Cast to number
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
          console.error('UNKNOWN Type:', schema);
      }

      fields.push({
        name: col.name,
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

/**
 * @param keepOriginalNames by default, the exported Table will get names that match the
 * display within grafana.  This typically includes any labels defined in the metadata.
 *
 * When using this function to round-trip data, be sure to set `keepOriginalNames=true`
 */
export function grafanaDataFrameToArrowTable(data: DataFrame, keepOriginalNames?: boolean): Table {
  // Return the original table
  let table = (data as any).table;
  if (table instanceof Table && table.numCols === data.fields.length) {
    if (!keepOriginalNames) {
      table = updateArrowTableNames(table, data);
    }
    if (table) {
      return table as Table;
    }
  }

  table = Table.new(
    data.fields.map((field, index) => {
      let name = field.name;
      // when used directly as an arrow table the name should match the arrow schema
      if (!keepOriginalNames) {
        name = getFieldDisplayName(field, data);
      }
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

function updateArrowTableNames(table: Table, frame: DataFrame): Table | undefined {
  const cols: Column[] = [];
  for (let i = 0; i < table.numCols; i++) {
    const col = table.getColumnAt(i);
    if (!col) {
      return undefined;
    }
    const name = getFieldDisplayName(frame.fields[i], frame);
    cols.push(Column.new(col.field.clone({ name: name }), ...col.chunks));
  }
  return Table.new(cols);
}

class NumberColumn extends FunctionalVector<number> {
  constructor(private col: Column) {
    super();
  }

  get length() {
    return this.col.length;
  }

  get(index: number): number {
    const v = this.col.get(index);
    if (v === null || isNaN(v)) {
      return v;
    }

    // The conversion operations are always silent, never give errors,
    // but if the bigint is too huge and won’t fit the number type,
    // then extra bits will be cut off, so we should be careful doing such conversion.
    // See https://javascript.info/bigint
    return Number(v);
  }
}
