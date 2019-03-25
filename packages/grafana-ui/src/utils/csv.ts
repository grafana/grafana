// Libraries
import Papa, { ParseResult, ParseConfig, Parser } from 'papaparse';

// Types
import { SeriesData, Field, FieldType } from '../types/index';
import { guessFieldTypeFromValue } from './processSeriesData';

// Subset of all parse options
export interface CSVParseConfig {
  delimiter?: string; // default: ","
  newline?: string; // default: "\r\n"
  quoteChar?: string; // default: '"'
  encoding?: string; // default: ""
}

export interface CSVParseCallbacks {
  /**
   * Get a callback before any rows are processed
   * This can return a modified table to force any
   * Column configurations
   */
  onHeader: (table: SeriesData) => void;

  // Called after each row is read and
  onRow: (row: any[]) => void;
}

export interface CSVOptions {
  config?: CSVParseConfig;
  callback?: CSVParseCallbacks;
}

export function readCSV(csv: string, options?: CSVOptions): Promise<SeriesData[]> {
  // Wraps the string in a ReadableStreamReader
  return readCSVFromStream(
    {
      cancel: () => {
        return Promise.reject('unsupported');
      },
      read: () => {
        return Promise.resolve({ done: true, value: csv });
      },
      releaseLock: () => {},
    },
    options
  );
}

enum ParseState {
  Starting,
  InHeader,
  ReadingRows,
}

type FieldParser = (value: string) => any;

export function readCSVFromStream(reader: ReadableStreamReader<string>, options?: CSVOptions): Promise<SeriesData[]> {
  return new Promise((resolve, reject) => {
    const config = options ? options.config : {};
    const callback = options ? options.callback : null;

    const column: FieldParser[] = [];
    let state = ParseState.Starting;
    let table: SeriesData = {
      fields: [],
      rows: [],
    };
    const tables: SeriesData[] = [table];

    const step = (results: ParseResult, parser: Parser): void => {
      for (let i = 0; i < results.data.length; i++) {
        const line: string[] = results.data[i];
        if (line.length > 0) {
          const first = line[0]; // null or value, papaparse does not return ''
          if (first) {
            // Comment or header queue
            if (first.startsWith('#')) {
              // Look for special header column
              // #{columkey}#a,b,c
              const idx = first.indexOf('#', 2);
              if (idx > 0) {
                const k = first.substr(1, idx - 1);

                // Simple object used to check if headers match
                const headerKeys: Field = {
                  name: '#',
                  type: FieldType.number,
                  unit: '#',
                  dateFormat: '#',
                };

                // Check if it is a known/supported column
                if (headerKeys.hasOwnProperty(k)) {
                  // Starting a new table after reading rows
                  if (state === ParseState.ReadingRows) {
                    table = {
                      fields: [],
                      rows: [],
                    };
                    tables.push(table);
                  }

                  padColumnWidth(table.fields, line.length);
                  const fields: any[] = table.fields; // cast to any so we can lookup by key
                  const v = first.substr(idx + 1);
                  fields[0][k] = v;
                  for (let j = 1; j < fields.length; j++) {
                    fields[j][k] = line[j];
                  }
                  state = ParseState.InHeader;
                  continue;
                }
              } else if (state === ParseState.Starting) {
                table.fields = makeFieldsFor(line);
                state = ParseState.InHeader;
                continue;
              }
              // Ignore comment lines
              continue;
            }

            if (state === ParseState.Starting) {
              const type = guessFieldTypeFromValue(first);
              if (type === FieldType.string) {
                table.fields = makeFieldsFor(line);
                state = ParseState.InHeader;
                continue;
              }
              table.fields = makeFieldsFor(new Array(line.length));
              table.fields[0].type = type;
              state = ParseState.InHeader; // fall through to read rows
            }
          }

          if (state === ParseState.InHeader) {
            padColumnWidth(table.fields, line.length);
            state = ParseState.ReadingRows;
          }

          if (state === ParseState.ReadingRows) {
            // Make sure colum structure is valid
            if (line.length > table.fields.length) {
              padColumnWidth(table.fields, line.length);
              if (callback) {
                callback.onHeader(table);
              } else {
                // Expand all rows with nulls
                for (let x = 0; x < table.rows.length; x++) {
                  const row = table.rows[x];
                  while (row.length < line.length) {
                    row.push(null);
                  }
                }
              }
            }

            const row: any[] = [];
            for (let j = 0; j < line.length; j++) {
              const v = line[j];
              if (v) {
                if (!column[j]) {
                  column[j] = makeFieldParser(v, table.fields[j]);
                }
                row.push(column[j](v));
              } else {
                row.push(null);
              }
            }

            if (callback) {
              // Send the header after we guess the type
              if (table.rows.length === 0) {
                callback.onHeader(table);
                table.rows.push(row); // Only add the first row
              }
              callback.onRow(row);
            } else {
              table.rows.push(row);
            }
          }
        }
      }
    };

    const papacfg = {
      ...config,
      dynamicTyping: false,
      skipEmptyLines: true,
      comments: false, // Keep comment lines
      step,
    } as ParseConfig;

    const processText = (value: ReadableStreamReadResult<string>): any => {
      if (value.value) {
        Papa.parse(value.value, papacfg);
      }
      if (value.done) {
        resolve(tables);
        return;
      }
      return reader.read().then(processText);
    };
    reader.read().then(processText);
  });
}

function makeFieldParser(value: string, column: Field): FieldParser {
  if (!column.type) {
    column.type = guessFieldTypeFromValue(value);
  }

  if (column.type === FieldType.number) {
    return (value: string) => {
      return parseFloat(value);
    };
  }

  // Will convert anything that starts with "T" to true
  if (column.type === FieldType.boolean) {
    return (value: string) => {
      return !(value[0] === 'F' || value[0] === 'f' || value[0] === '0');
    };
  }

  // Just pass the string back
  return (value: string) => value;
}

/**
 * Creates a column object for each string in the list
 */
function makeFieldsFor(line: string[]): Field[] {
  const fields: Field[] = [];
  for (let i = 0; i < line.length; i++) {
    const v = line[i] ? line[i] : 'Column ' + (i + 1);
    fields.push({ name: v });
  }
  return fields;
}

/**
 * Makes sure the colum has valid entries up the the width
 */
function padColumnWidth(fields: Field[], width: number) {
  if (fields.length < width) {
    for (let i = fields.length; i < width; i++) {
      fields.push({
        name: 'Field ' + (i + 1),
      });
    }
  }
}
