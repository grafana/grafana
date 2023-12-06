import * as duckdb from '@duckdb/duckdb-wasm';

import { DataFrame, FieldType, Field } from '@grafana/data';

let ddb: duckdb.AsyncDuckDB | undefined = undefined;

export async function getDuckDB(): Promise<duckdb.AsyncDuckDB> {
  if (ddb) {
    return ddb;
  }
  // TODO??? only load once!!!! (share the loading promise)

  console.log('loading duckdb');
  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();

  // Select a bundle based on browser checks
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

  const worker_url = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker!}");`], { type: 'text/javascript' })
  );

  // Instantiate the asynchronus version of DuckDB-Wasm
  const worker = new Worker(worker_url);
  const logger = new duckdb.ConsoleLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(worker_url);
  console.log('loaded duckdb', db);
  return (ddb = db);
}

// importing arrow is not the same as the one returned from query results... not sure the best approach here
export function arrowTableToFrame(table: any /* arrow.Table */): DataFrame {
  const fields: Field[] = [];

  const length = table.numRows;
  for (let i = 0; i < table.numCols; i++) {
    const col = table.getChildAt(i);
    if (!col) {
      continue;
    }
    const schema = table.schema.fields[i];
    let type = FieldType.other;
    let values = new Array(length);
    switch (schema.typeId) {
      case Type.Decimal:
      case Type.Float:
      case Type.Float16:
      case Type.Float32:
      case Type.Float64:
      case Type.Int:
      case Type.Int8:
      case Type.Int16:
      case Type.Int32:
      case Type.Int64: {
        type = FieldType.number;
        for (let i = 0; i < length; i++) {
          values[i] = asNumber(col.get(i)); // cast to regular number
        }
        break;
      }
      case Type.Bool: {
        type = FieldType.boolean;
        for (let i = 0; i < length; i++) {
          values[i] = asBool(col.get(i)); // cast to regular number
        }
        break;
      }
      case Type.Utf8: {
        type = FieldType.string;
        for (let i = 0; i < length; i++) {
          values[i] = asString(col.get(i)); // cast to regular number
        }
        break;
      }
      default:
        type = FieldType.string;
        for (let i = 0; i < length; i++) {
          values[i] = `Unknown type[${schema.typeId}] ${col.get(i)}`;
        }
        break;
    }

    fields.push({
      name: schema.name,
      type,
      values,
      config: {}, // parseOptionalMeta(col.metadata.get('config')) || {},
    });
  }
  return { fields, length };
}

function asNumber(v?: any): Number | undefined | null {
  return v == null ? v : Number(v);
}
function asBool(v?: any): Boolean | undefined | null {
  return v == null ? v : Boolean(v);
}
function asString(v?: any): String | undefined | null {
  return v == null ? v : String(v);
}

// COPIED FROM arrow
export enum Type {
  NONE = 0 /** The default placeholder type */,
  Null = 1 /** A NULL type having no physical storage */,
  Int = 2 /** Signed or unsigned 8, 16, 32, or 64-bit little-endian integer */,
  Float = 3 /** 2, 4, or 8-byte floating point value */,
  Binary = 4 /** Variable-length bytes (no guarantee of UTF8-ness) */,
  Utf8 = 5 /** UTF8 variable-length string as List<Char> */,
  Bool = 6 /** Boolean as 1 bit, LSB bit-packed ordering */,
  Decimal = 7 /** Precision-and-scale-based decimal type. Storage type depends on the parameters. */,
  Date = 8 /** int32_t days or int64_t milliseconds since the UNIX epoch */,
  Time = 9 /** Time as signed 32 or 64-bit integer, representing either seconds, milliseconds, microseconds, or nanoseconds since midnight since midnight */,
  Timestamp = 10 /** Exact timestamp encoded with int64 since UNIX epoch (Default unit millisecond) */,
  Interval = 11 /** YEAR_MONTH or DAY_TIME interval in SQL style */,
  List = 12 /** A list of some logical data type */,
  Struct = 13 /** Struct of logical types */,
  Union = 14 /** Union of logical types */,
  FixedSizeBinary = 15 /** Fixed-size binary. Each value occupies the same number of bytes */,
  FixedSizeList = 16 /** Fixed-size list. Each value occupies the same number of bytes */,
  Map = 17 /** Map of named logical types */,

  Dictionary = -1 /** Dictionary aka Category type */,
  Int8 = -2,
  Int16 = -3,
  Int32 = -4,
  Int64 = -5,
  Uint8 = -6,
  Uint16 = -7,
  Uint32 = -8,
  Uint64 = -9,
  Float16 = -10,
  Float32 = -11,
  Float64 = -12,
  DateDay = -13,
  DateMillisecond = -14,
  TimestampSecond = -15,
  TimestampMillisecond = -16,
  TimestampMicrosecond = -17,
  TimestampNanosecond = -18,
  TimeSecond = -19,
  TimeMillisecond = -20,
  TimeMicrosecond = -21,
  TimeNanosecond = -22,
  DenseUnion = -23,
  SparseUnion = -24,
  IntervalDayTime = -25,
  IntervalYearMonth = -26,
}
