// Libraries
import Papa, { ParseResult, ParseConfig, Parser } from 'papaparse';
import defaults from 'lodash/defaults';
import isNumber from 'lodash/isNumber';

// Types
import { SeriesData, Field, FieldType } from '../types/index';
import { guessFieldTypeFromValue } from './processSeriesData';

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
  onHeader: (table: SeriesData) => void;

  // Called after each row is read and
  onRow: (row: any[]) => void;
}

export interface CSVOptions {
  config?: CSVConfig;
  callback?: CSVParseCallbacks;
}

export function readCSV(csv: string, options?: CSVOptions): SeriesData[] {
  return new CSVReader(options).readCSV(csv);
}

enum ParseState {
  Starting,
  InHeader,
  ReadingRows,
}

type FieldParser = (value: string) => any;

export class CSVReader {
  config: CSVConfig;
  callback?: CSVParseCallbacks;

  field: FieldParser[];
  series: SeriesData;
  state: ParseState;
  data: SeriesData[];

  constructor(options?: CSVOptions) {
    if (!options) {
      options = {};
    }
    this.config = options.config || {};
    this.callback = options.callback;

    this.field = [];
    this.state = ParseState.Starting;
    this.series = {
      fields: [],
      rows: [],
    };
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
              if (this.state === ParseState.ReadingRows) {
                this.series = {
                  fields: [],
                  rows: [],
                };
                this.data.push(this.series);
              }

              padColumnWidth(this.series.fields, line.length);
              const fields: any[] = this.series.fields; // cast to any so we can lookup by key
              const v = first.substr(idx + 1);
              fields[0][k] = v;
              for (let j = 1; j < fields.length; j++) {
                fields[j][k] = line[j];
              }
              this.state = ParseState.InHeader;
              continue;
            }
          } else if (this.state === ParseState.Starting) {
            this.series.fields = makeFieldsFor(line);
            this.state = ParseState.InHeader;
            continue;
          }
          // Ignore comment lines
          continue;
        }

        if (this.state === ParseState.Starting) {
          const type = guessFieldTypeFromValue(first);
          if (type === FieldType.string) {
            this.series.fields = makeFieldsFor(line);
            this.state = ParseState.InHeader;
            continue;
          }
          this.series.fields = makeFieldsFor(new Array(line.length));
          this.series.fields[0].type = type;
          this.state = ParseState.InHeader; // fall through to read rows
        }
      }

      if (this.state === ParseState.InHeader) {
        padColumnWidth(this.series.fields, line.length);
        this.state = ParseState.ReadingRows;
      }

      if (this.state === ParseState.ReadingRows) {
        // Make sure colum structure is valid
        if (line.length > this.series.fields.length) {
          padColumnWidth(this.series.fields, line.length);
          if (this.callback) {
            this.callback.onHeader(this.series);
          } else {
            // Expand all rows with nulls
            for (let x = 0; x < this.series.rows.length; x++) {
              const row = this.series.rows[x];
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
            if (!this.field[j]) {
              this.field[j] = makeFieldParser(v, this.series.fields[j]);
            }
            row.push(this.field[j](v));
          } else {
            row.push(null);
          }
        }

        if (this.callback) {
          // Send the header after we guess the type
          if (this.series.rows.length === 0) {
            this.callback.onHeader(this.series);
            this.series.rows.push(row); // Only add the first row
          }
          this.callback.onRow(row);
        } else {
          this.series.rows.push(row);
        }
      }
    }
  };

  readCSV(text: string): SeriesData[] {
    this.data = [this.series];

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
  if (!field.type) {
    if (field.name === 'time' || field.name === 'Time') {
      field.type = FieldType.time;
    } else {
      field.type = guessFieldTypeFromValue(value);
    }
  }

  if (field.type === FieldType.number) {
    return (value: string) => {
      return parseFloat(value);
    };
  }

  // Will convert anything that starts with "T" to true
  if (field.type === FieldType.boolean) {
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

type FieldWriter = (value: any) => string;

function writeValue(value: any, config: CSVConfig): string {
  const str = value.toString();
  if (str.includes('"')) {
    // Escape the double quote characters
    return config.quoteChar + str.replace('"', '""') + config.quoteChar;
  }
  if (str.includes('\n') || str.includes(config.delimiter)) {
    return config.quoteChar + str + config.quoteChar;
  }
  return str;
}

function makeFieldWriter(field: Field, config: CSVConfig): FieldWriter {
  if (field.type) {
    if (field.type === FieldType.boolean) {
      return (value: any) => {
        return value ? 'true' : 'false';
      };
    }

    if (field.type === FieldType.number) {
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
  for (const f of fields) {
    if (f.hasOwnProperty(key)) {
      let line = '#' + key + '#';
      for (let i = 0; i < fields.length; i++) {
        if (i > 0) {
          line = line + config.delimiter;
        }

        const v = (fields[i] as any)[key];
        if (v) {
          line = line + writeValue(v, config);
        }
      }
      return line + config.newline;
    }
  }
  return '';
}

export function toCSV(data: SeriesData[], config?: CSVConfig): string {
  let csv = '';
  config = defaults(config, {
    delimiter: ',',
    newline: '\r\n',
    quoteChar: '"',
    encoding: '',
    headerStyle: CSVHeaderStyle.name,
  });

  for (const series of data) {
    const { rows, fields } = series;
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
    const writers = fields.map(field => makeFieldWriter(field, config!));
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      for (let j = 0; j < row.length; j++) {
        if (j > 0) {
          csv = csv + config.delimiter;
        }

        const v = row[j];
        if (v !== null) {
          csv = csv + writers[j](v);
        }
      }
      csv = csv + config.newline;
    }
    csv = csv + config.newline;
  }

  return csv;
}
