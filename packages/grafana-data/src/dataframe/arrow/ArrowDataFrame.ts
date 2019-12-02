import { DataFrame, FieldType, Field, Vector } from '../../types';
import { Table, ArrowType } from 'apache-arrow';

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
        default:
          console.log('UNKNOWN Type:', schema);
      }
      // console.log(' field>', schema.metadata);

      fields.push({
        name: col.name,
        type,
        config: {}, // TODO, pull from metadata
        values,
      });
    }
  }
  const meta = table.schema.metadata;
  return {
    fields,
    length: table.length,
    refId: valueOrUndefined(meta.get('refId')),
    name: valueOrUndefined(meta.get('name')),
    table,
  };
}

export function resultsToDataFrames(rsp: any): DataFrame[] {
  const frames: DataFrame[] = [];
  for (const res of Object.values(rsp.results)) {
    for (const b of (res as any).dataframes) {
      const t = base64StringToArrowTable(b as string);
      frames.push(arrowTableToDataFrame(t));
    }
  }
  return frames;
}
