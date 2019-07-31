// Libraries
import Papa, { ParseResult, ParseConfig, Parser } from 'papaparse';
import defaults from 'lodash/defaults';
import isNumber from 'lodash/isNumber';

// Types
import { DataFrame, Field, FieldType, FieldSchema } from '../types';
import { guessFieldTypeFromValue } from './processDataFrame';
import { ArrayVector } from './vector';

export enum CSVHeaderStyle {
  full,
  name,
  none,
}

// Subset of all parse options
export interface CSVConfig {
  delimiter?: string; // default: ","
  newline?: string; // default: "\r\n"
  quoteChar?: string; // default: '"'
  encoding?: string; // default: "",
  headerStyle?: CSVHeaderStyle;
}

export interface CSVParseCallbacks {
  /**
   * Get a callback before any rows are processed
   * This can return a modified table to force any
   * Column configurations
   */
  onHeader: (table: DataFrame) => void;

  // Called after each row is read and
  onRow: (row: any[]) => void;
}

export interface CSVOptions {
  config?: CSVConfig;
  callback?: CSVParseCallbacks;
}

export function readCSV(csv: string, options?: CSVOptions): DataFrame[] {
  return new CSVReader(options).readCSV(csv);
}

enum ParseState {
  Starting,
  InHeader,
  ReadingRows,
}

type FieldParser = (value: string) => any;

type AnyField = Field<any, ArrayVector<any>>;

export class CSVReader {
  config: CSVConfig;
  callback?: CSVParseCallbacks;

  field: FieldParser[];
  state: ParseState;
  data: DataFrame[];
  fields: AnyField[];

  constructor(options?: CSVOptions) {
    if (!options) {
      options = {};
    }
    this.config = options.config || {};
    this.callback = options.callback;

    this.field = [];
    this.state = ParseState.Starting;
    this.fields = [];
    this.data = [];
  }

  // PapaParse callback on each line
  private step = (results: ParseResult, parser: Parser): void => {
    for (let i = 0; i < results.data.length; i++) {
      const line: string[] = results.data[i];
      if (line.length < 1) {
        continue;
      }
      const first = line[0]; // null or value, papaparse does not return ''
      if (first) {
        // Comment or header queue
        if (first.startsWith('#')) {
          // Look for special header column
          // #{columkey}#a,b,c
          const idx = first.indexOf('#', 2);
          if (idx > 0) {
            const k = first.substr(1, idx - 1);
            const isName = 'name' === k;

            // Simple object used to check if headers match
            const headerKeys: FieldSchema = {
              type: FieldType.number,
              unit: '#',
              dateSourceFormat: '#',
            };

            // Check if it is a known/supported column
            if (isName || headerKeys.hasOwnProperty(k)) {
              // Starting a new table after reading rows
              if (this.state === ParseState.ReadingRows) {
                this.data.push({
                  fields: this.fields,
                });
                this.fields = [];
              }

              // Fix any column sizing issues
              padColumnWidth(this.fields, line.length);

              const v = first.substr(idx + 1);
              if (isName) {
                this.fields[0].name = v;
                for (let j = 1; j < this.fields.length; j++) {
                  this.fields[j].name = line[j];
                }
              } else {
                for (let j = 0; j < this.fields.length; j++) {
                  const schema = this.fields[j].schema as any; // any lets name lookup
                  schema[k] = j === 0 ? v : line[j];
                }
              }

              this.state = ParseState.InHeader;
              continue;
            }
          } else if (this.state === ParseState.Starting) {
            this.fields = makeFieldsFor(line);
            this.state = ParseState.InHeader;
            continue;
          }
          // Ignore comment lines
          continue;
        }

        if (this.state === ParseState.Starting) {
          const type = guessFieldTypeFromValue(first);
          if (type === FieldType.string) {
            this.fields = makeFieldsFor(line);
            this.state = ParseState.InHeader;
            continue;
          }
          this.fields = makeFieldsFor(new Array(line.length));
          this.fields[0].schema.type = type;
          this.state = ParseState.InHeader; // fall through to read rows
        }
      }

      if (this.state === ParseState.InHeader) {
        padColumnWidth(this.fields, line.length);
        this.state = ParseState.ReadingRows;
      }

      if (this.state === ParseState.ReadingRows) {
        // Make sure colum structure is valid
        if (line.length > this.fields.length) {
          padColumnWidth(this.fields, line.length);
          if (this.callback) {
            this.callback.onHeader({ fields: this.fields });
          }
        }

        const row: any[] = [];
        for (let j = 0; j < line.length; j++) {
          let v: any = line[j];
          if (v) {
            if (!this.field[j]) {
              this.field[j] = makeFieldParser(v, this.fields[j]);
            }
            v = this.field[j](v);
          } else {
            v = null;
          }
          this.fields[j].values.buffer.push(v);
          if (this.callback) {
            row.push(v);
          }
        }

        if (this.callback) {
          // // Send the header after we guess the type
          // if (this.series.rows.length === 0) {
          //   this.callback.onHeader(this.series);
          //   this.series.rows.push(row); // Only add the first row
          // }
          this.callback.onRow(row);
        }
      }
    }
  };

  readCSV(text: string): DataFrame[] {
    this.data = [];

    const papacfg = {
      ...this.config,
      dynamicTyping: false,
      skipEmptyLines: true,
      comments: false, // Keep comment lines
      step: this.step,
    } as ParseConfig;

    Papa.parse(text, papacfg);
    return this.data;
  }
}

function makeFieldParser(value: string, field: Field): FieldParser {
  let schema = field.schema;
  if (!schema || !schema.type) {
    if (!schema) {
      field.schema = schema = {};
    }
    if (field.name === 'time' || field.name === 'Time') {
      schema.type = FieldType.time;
    } else {
      schema.type = guessFieldTypeFromValue(value);
    }
  }

  if (schema.type === FieldType.number) {
    return (value: string) => {
      return parseFloat(value);
    };
  }

  // Will convert anything that starts with "T" to true
  if (schema.type === FieldType.boolean) {
    return (value: string) => {
      return !(value[0] === 'F' || value[0] === 'f' || value[0] === '0');
    };
  }

  // Just pass the string back
  return (value: string) => value;
}

/**
 * Creates a field object for each string in the list
 */
function makeFieldsFor(line: string[]): AnyField[] {
  const fields: AnyField[] = [];
  for (let i = 0; i < line.length; i++) {
    const v = line[i] ? line[i] : 'Column ' + (i + 1);
    fields.push({ name: v, schema: {}, values: new ArrayVector([]) });
  }
  return fields;
}

type FieldWriter = (value: any) => string;

function writeValue(value: any, config: CSVConfig): string {
  const str = value.toString();
  if (str.includes('"')) {
    // Escape the double quote characters
    return config.quoteChar + str.replace(/"/gi, '""') + config.quoteChar;
  }
  if (str.includes('\n') || str.includes(config.delimiter)) {
    return config.quoteChar + str + config.quoteChar;
  }
  return str;
}

function makeFieldWriter(field: Field, config: CSVConfig): FieldWriter {
  const { schema } = field;
  if (schema.type) {
    if (schema.type === FieldType.boolean) {
      return (value: any) => {
        return value ? 'true' : 'false';
      };
    }

    if (schema.type === FieldType.number) {
      return (value: any) => {
        if (isNumber(value)) {
          return value.toString();
        }
        return writeValue(value, config);
      };
    }
  }

  return (value: any) => writeValue(value, config);
}

function getHeaderLine(key: string, fields: Field[], config: CSVConfig): string {
  const isName = 'name' === key;

  for (const f of fields) {
    const schema = f.schema;
    if (isName || schema.hasOwnProperty(key)) {
      let line = '#' + key + '#';
      for (let i = 0; i < fields.length; i++) {
        if (i > 0) {
          line = line + config.delimiter;
        }

        const v = isName ? f.name : (fields[i].schema as any)[key];
        if (v) {
          line = line + writeValue(v, config);
        }
      }
      return line + config.newline;
    }
  }
  return '';
}

export function toCSV(data: DataFrame[], config?: CSVConfig): string {
  if (!data) {
    return '';
  }

  let csv = '';
  config = defaults(config, {
    delimiter: ',',
    newline: '\r\n',
    quoteChar: '"',
    encoding: '',
    headerStyle: CSVHeaderStyle.name,
  });

  for (const series of data) {
    const { fields } = series;
    if (config.headerStyle === CSVHeaderStyle.full) {
      csv =
        csv +
        getHeaderLine('name', fields, config) +
        getHeaderLine('type', fields, config) +
        getHeaderLine('unit', fields, config) +
        getHeaderLine('dateFormat', fields, config);
    } else if (config.headerStyle === CSVHeaderStyle.name) {
      for (let i = 0; i < fields.length; i++) {
        if (i > 0) {
          csv += config.delimiter;
        }
        csv += fields[i].name;
      }
      csv += config.newline;
    }
    const length = fields[0].values.length;
    if (length > 0) {
      const writers = fields.map(field => makeFieldWriter(field, config!));
      for (let i = 0; i < length; i++) {
        for (let j = 0; j < fields.length; j++) {
          if (j > 0) {
            csv = csv + config.delimiter;
          }

          const v = fields[j].values.get(i);
          if (v !== null) {
            csv = csv + writers[j](v);
          }
        }
        csv = csv + config.newline;
      }
    }
    csv = csv + config.newline;
  }

  return csv;
}

/**
 * Make sure a field exists for the entire width and fill any extras with null
 */
function padColumnWidth(fields: AnyField[], width: number) {
  if (fields.length === width) {
    return; // no changes
  }

  // Find the maximum length of all the fields
  const length = fields.reduce((prev, field) => {
    return Math.max(prev, field.values.length);
  }, 0);

  // Add extra columns
  for (let i = fields.length; i < width; i++) {
    fields.push({
      name: `Field ${i + 1}`,
      schema: {},
      values: new ArrayVector([]),
    });
  }

  // Fill the column values
  for (const field of fields) {
    if (field.values.length < length) {
      for (let i = field.values.length; i < length; i++) {
        field.values.buffer.push(null);
      }
    }
  }
}
