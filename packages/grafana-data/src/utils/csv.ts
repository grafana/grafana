// Libraries
import { defaults } from 'lodash';
import Papa, { ParseConfig, Parser, ParseResult } from 'papaparse';

// Types
import { MutableDataFrame } from '../dataframe/MutableDataFrame';
import { guessFieldTypeFromValue } from '../dataframe/processDataFrame';
import { getFieldDisplayName } from '../field/fieldState';
import { DataFrame, Field, FieldConfig, FieldType } from '../types/dataFrame';
import { formattedValueToString } from '../valueFormats/valueFormats';

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
  useExcelHeader?: boolean; // default: false
  headerStyle?: CSVHeaderStyle;
}

export interface CSVParseCallbacks {
  /**
   * Get a callback before any rows are processed
   * This can return a modified table to force any
   * Column configurations
   */
  onHeader: (fields: Field[]) => void;

  // Called after each row is read
  onRow: (row: string[]) => void;
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

export class CSVReader {
  config: CSVConfig;
  callback?: CSVParseCallbacks;

  state: ParseState;
  data: MutableDataFrame[];
  current: MutableDataFrame;

  constructor(options?: CSVOptions) {
    if (!options) {
      options = {};
    }
    this.config = options.config || {};
    this.callback = options.callback;

    this.current = new MutableDataFrame({ fields: [] });
    this.state = ParseState.Starting;
    this.data = [];
  }

  // PapaParse callback on each line
  private chunk = (results: ParseResult<string[]>, parser: Parser): void => {
    for (let i = 0; i < results.data.length; i++) {
      const line = results.data[i];
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
            const k = first.slice(1, idx);
            const isName = 'name' === k;

            // Simple object used to check if headers match
            const headerKeys: FieldConfig = {
              unit: '#',
            };

            // Check if it is a known/supported column
            if (isName || headerKeys.hasOwnProperty(k)) {
              // Starting a new table after reading rows
              if (this.state === ParseState.ReadingRows) {
                this.current = new MutableDataFrame({ fields: [] });
                this.data.push(this.current);
              }

              const v = first.slice(idx + 1);
              if (isName) {
                this.current.addFieldFor(undefined, v);
                for (let j = 1; j < line.length; j++) {
                  this.current.addFieldFor(undefined, line[j]);
                }
              } else {
                const { fields } = this.current;
                for (let j = 0; j < fields.length; j++) {
                  if (!fields[j].config) {
                    fields[j].config = {};
                  }
                  const disp = fields[j].config as any; // any lets name lookup
                  disp[k] = j === 0 ? v : line[j];
                }
              }

              this.state = ParseState.InHeader;
              continue;
            }
          } else if (this.state === ParseState.Starting) {
            this.state = ParseState.InHeader;
            continue;
          }
          // Ignore comment lines
          continue;
        }

        if (this.state === ParseState.Starting) {
          const type = guessFieldTypeFromValue(first);
          if (type === FieldType.string) {
            for (const s of line) {
              this.current.addFieldFor(undefined, s);
            }
            this.state = ParseState.InHeader;
            continue;
          }
          this.state = ParseState.InHeader; // fall through to read rows
        }
      }

      // Add the current results to the data
      if (this.state !== ParseState.ReadingRows) {
        // anything???
      }

      this.state = ParseState.ReadingRows;

      // Make sure column structure is valid
      if (line.length > this.current.fields.length) {
        const { fields } = this.current;
        for (let f = fields.length; f < line.length; f++) {
          this.current.addFieldFor(line[f]);
        }
        if (this.callback) {
          this.callback.onHeader(this.current.fields);
        }
      }

      this.current.appendRow(line);
      if (this.callback) {
        // // Send the header after we guess the type
        // if (this.series.rows.length === 0) {
        //   this.callback.onHeader(this.series);
        // }
        this.callback.onRow(line);
      }
    }
  };

  readCSV(text: string): MutableDataFrame[] {
    this.current = new MutableDataFrame({ fields: [] });
    this.data = [this.current];

    const papacfg = {
      ...this.config,
      dynamicTyping: false,
      skipEmptyLines: true,
      comments: false, // Keep comment lines
      chunk: this.chunk,
    } as ParseConfig;

    Papa.parse(text, papacfg);

    return this.data;
  }
}

type FieldWriter = (value: unknown) => string;

function writeValue(value: unknown, config: CSVConfig): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = value.toString();
  if (str.includes('"')) {
    // Escape the double quote characters
    return config.quoteChar + str.replace(/"/gi, '""') + config.quoteChar;
  }
  if (str.includes('\n') || (config.delimiter && str.includes(config.delimiter))) {
    return config.quoteChar + str + config.quoteChar;
  }
  return str;
}

function makeFieldWriter(field: Field, config: CSVConfig): FieldWriter {
  if (field.display) {
    return (value: unknown) => {
      const displayValue = field.display!(value);
      return writeValue(formattedValueToString(displayValue), config);
    };
  }

  return (value: unknown) => writeValue(value, config);
}

function getHeaderLine(key: string, fields: Field[], config: CSVConfig): string {
  const isName = 'name' === key;
  const isType = 'type' === key;

  for (const f of fields) {
    const display = f.config;
    if (isName || isType || (display && display.hasOwnProperty(key))) {
      let line = '#' + key + '#';
      for (let i = 0; i < fields.length; i++) {
        if (i > 0) {
          line = line + config.delimiter;
        }

        let v = fields[i].name;
        if (isType) {
          v = fields[i].type;
        } else if (isName) {
          // already name
        } else {
          v = (fields[i].config as any)[key];
        }
        if (v) {
          line = line + writeValue(v, config);
        }
      }
      return line + config.newline;
    }
  }
  return '';
}

function getLocaleDelimiter(): string {
  const arr = ['x', 'y'];
  if (arr.toLocaleString) {
    return arr.toLocaleString().charAt(1);
  }
  return ',';
}

export function toCSV(data: DataFrame[], config?: CSVConfig): string {
  if (!data) {
    return '';
  }

  config = defaults(config, {
    delimiter: getLocaleDelimiter(),
    newline: '\r\n',
    quoteChar: '"',
    encoding: '',
    headerStyle: CSVHeaderStyle.name,
    useExcelHeader: false,
  });
  let csv = config.useExcelHeader ? `sep=${config.delimiter}${config.newline}` : '';

  for (let s = 0; s < data.length; s++) {
    const series = data[s];
    const { fields } = series;

    // ignore frames with no fields
    if (fields.length === 0) {
      continue;
    }

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
        csv += `"${getFieldDisplayName(fields[i], series).replace(/"/g, '""')}"`;
      }
      csv += config.newline;
    }

    const length = fields[0].values.length;

    if (length > 0) {
      const writers = fields.map((field) => makeFieldWriter(field, config!));
      for (let i = 0; i < length; i++) {
        for (let j = 0; j < fields.length; j++) {
          if (j > 0) {
            csv += config.delimiter;
          }

          let v = fields[j].values[i];

          if (v !== null) {
            // For FieldType frame, use value if it exists to prevent exporting [object object]
            if (fields[j].type === FieldType.frame && 'value' in v) {
              v = v.value;
            }

            csv += writers[j](v);
          }
        }

        if (i !== length - 1) {
          csv += config.newline;
        }
      }
    }

    if (s !== data.length - 1) {
      csv = csv + config.newline;
    }
  }

  return csv;
}
