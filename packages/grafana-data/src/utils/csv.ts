// Libraries
import { defaults } from 'lodash';
import Papa, { ParseConfig, Parser, ParseResult } from 'papaparse';

//BMC Code : Start
// eslint-disable-next-line no-restricted-imports
import { ArrayVector } from '@grafana/data';
//BMC Code : end
// eslint-disable-next-line no-restricted-imports
import { config as configurations } from '@grafana/runtime';

// Types
import { MutableDataFrame } from '../dataframe/MutableDataFrame';
import { guessFieldTypeFromValue } from '../dataframe/processDataFrame';
import { getFieldDisplayName } from '../field/fieldState';
import { fieldReducers, reduceField } from '../transformations/fieldReducer';
import { DataFrame, Field, FieldConfig, FieldType } from '../types/dataFrame';
import { formattedValueToString } from '../valueFormats/valueFormats';

import { detectScript, isMultilingualPdfEnabled, isExportFooterEnabled, Script } from './scriptUtils';
import { EnclosureMode, NewlineMode } from './csvOptions';

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
  enableOverrides?: boolean;
  panelId?: number;
  enclosed?: string; // default: "default",
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
    return config.enclosed === EnclosureMode.Double ? (config.quoteChar ?? '"') + (config.quoteChar ?? '"') : '';
  }
  const str = value.toString();
  // always quote when enclosed='double'
  if (config.enclosed === EnclosureMode.Double) {
    const escaped = str.includes('"') ? str.replace(/"/gi, '""') : str;
    return config.quoteChar + escaped + config.quoteChar;
  }

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
  // BMC Code: Start
  const urlParams = new URLSearchParams(window.location.search);
  const delimiter = urlParams.get('csvDelimiter');
  if (delimiter && ((window as any).grafanaBootData.settings.csvDelimiters ?? []).includes(delimiter)) {
    return delimiter;
  }
  // BMC Code: end
  const arr = ['x', 'y'];
  if (arr.toLocaleString) {
    return arr.toLocaleString().charAt(1);
  }
  return ',';
}

// BMC Code: Start
export function getFooterValue<T = any>(field: Field<T>, reducerId: string, length: number): any {
  const reducerInfo = fieldReducers.get(reducerId);
  if (!reducerInfo) {
    return null;
  }

  const fullValues = field.values.toArray();
  const rawValues = length < fullValues.length ? fullValues.slice(0, length) : fullValues;

  const slicedValues = new ArrayVector<T>(rawValues as never);

  const limitedField: Field<T> = {
    ...field,
    values: slicedValues,
    state: {
      ...(field.state ?? {}),
      calcs: undefined,
    },
  };

  const result = reduceField({
    field: limitedField,
    reducers: [reducerId],
  });

  return result[reducerId];
}

export function getFooterLabel(reducerId: string): string {
  return fieldReducers.get(reducerId)?.name ?? reducerId;
}

function addFooterRow(
  fields: Field[],
  footerFields: string[],
  reducerType: string,
  config: CSVConfig,
  footerRow: string[],
  enableOverrides: boolean,
  rowCount: number,
  writers: FieldWriter[]
) {
  const reducerLabel = getFooterLabel(reducerType);
  const firstVisibleField = fields.find((f) => !f.config.custom?.hidden);

  for (const element of fields) {
    if (element.config.custom?.hidden) {
      continue;
    }

    let cellValue = '';
    const isFirstVisible = element === firstVisibleField;
    const fieldName = element.name;
    const isFooterField = footerFields.includes(fieldName);
    const isNumberField = element.type === FieldType.number;

    if (isFirstVisible) {
      if (isFooterField && isNumberField) {
        let footerValue = getFooterValue(element, reducerType, rowCount) ?? ' ';
        footerValue = writers[fields.indexOf(element)](footerValue);
        const displayValue = footerValue;
        cellValue = enableOverrides
          ? getCellStyleWithValue(element, displayValue, -1, config, true)
          : `"${displayValue}"`;
      } else {
        cellValue = enableOverrides
          ? getCellStyleWithValue(element, reducerLabel, -1, config, true)
          : `"${reducerLabel}"`;
      }
    } else if (isFooterField) {
      if (isNumberField) {
        let footerValue = getFooterValue(element, reducerType, rowCount) ?? ' ';
        footerValue = writers[fields.indexOf(element)](footerValue);
        const displayValue = footerValue;
        cellValue = enableOverrides
          ? getCellStyleWithValue(element, displayValue, -1, config, true)
          : `"${displayValue}"`;
      } else {
        cellValue = enableOverrides ? getCellStyleWithValue(element, ' ', -1, config, true) : ' ';
      }
    } else {
      cellValue = enableOverrides ? getCellStyleWithValue(element, ' ', -1, config, true) : ' ';
    }

    footerRow.push(cellValue);
  }
}

// Helper function to get current panel by ID
const getCurrentPanel = (panelId: string): any => {
  if (!configurations.bootData.settings.featureToggles.dashboardScene) {
    return (window as any).grafanaRuntime.getPanels()?.find((p: any) => p.id === parseInt(panelId, 10));
  } else {
    return (window as any).grafanaRuntime.getPanels()?.find((p: any) => p.id === panelId);
  }
};
// BMC Code: End

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
    enclosed: 'default',
  });

  let csv = config.useExcelHeader ? `sep=${config.delimiter}${config.newline}` : '';

  // BMC Code: Start

  const urlParams = new URLSearchParams(window.location.search);
  const enableOverrides = config.enableOverrides === true || urlParams.get('enableOverrides') === 'true';
  const fullTable = urlParams.get('fullTable');
  const rowsLimit = Number(urlParams.get('limit') || '5000');
  const enclosed = urlParams.get('enclosed'); // "default" | "double"
  const newlineParam = urlParams.get('newline');
  if (newlineParam === NewlineMode.CRLF) {
    config.newline = '\r\n';
  } else if (newlineParam === NewlineMode.LF) {
    config.newline = '\n';
  } else if (newlineParam === NewlineMode.CR) {
    config.newline = '\r';
  }
  if (enclosed === EnclosureMode.Double) {
    config.enclosed = EnclosureMode.Double;
  }
  let detectedScript: Script | null = null;
  const isExportFooter = isExportFooterEnabled();
  const hideHeader = urlParams.get('hideHeader') === 'true';
  // BMC Code: End

  for (let s = 0; s < data.length; s++) {
    const series = data[s];
    const { fields } = series;
    // BMC Code: Start
    let atleastOneColumnFilled = {
      header: false,
      data: false,
    };
    // BMC Code: end
    // ignore frames with no fields
    if (fields.length === 0) {
      continue;
    }

    // BMC Code: Start
    const footerRow: string[] = [];
    const panelid = urlParams.get('viewPanel') || `${config.panelId}` || '0';

    const currentPanel = getCurrentPanel(panelid);

    const footer = currentPanel?.options?.footer?.show;
    const footerFields = currentPanel?.options?.footer?.fields || []; // Fields to apply footer
    const reducerType = currentPanel?.options?.footer?.reducer?.[0]; // 'max'
    const multilingualPdfEnabled = isMultilingualPdfEnabled();
    // BMC Code: end

    if (!hideHeader) {
      if (config.headerStyle === CSVHeaderStyle.full) {
        csv =
          csv +
          getHeaderLine('name', fields, config) +
          getHeaderLine('type', fields, config) +
          getHeaderLine('unit', fields, config) +
          getHeaderLine('dateFormat', fields, config);
      } else if (config.headerStyle === CSVHeaderStyle.name) {
        for (let i = 0; i < fields.length; i++) {
          // BMC Code: Start
          // Filtering hidden columns
          if (fields[i].config.custom && fields[i].config.custom.hidden) {
            continue;
          }
          // BMC Code: end
          if (i > 0 && atleastOneColumnFilled.header) {
            csv += config.delimiter;
          }
          // BMC Code: Start
          // Apply delimiter only after first column (header) has been filled
          atleastOneColumnFilled.header = true;

          const fieldDisplayName = getFieldDisplayName(fields[i], series).replace(/"/g, '""');
          if (enableOverrides) {
            if (multilingualPdfEnabled && detectedScript === null) {
              // for detection in column headers
              detectedScript = detectScript(fieldDisplayName || '');
            }
            const metaStr = getMetaTagForField(fields[i], i, multilingualPdfEnabled, currentPanel);
            csv += `"${fieldDisplayName}[@meta@]${metaStr}"`;
          } else {
            csv += `"${fieldDisplayName}"`;
          }
          // BMC Code: end
        }
        // BMC Code: Start
        if (footer && reducerType && footerFields.length > 0 && isExportFooter && enableOverrides) {
          let rowCount = fields[0]?.values?.length;
          let writers = fields.map((f) => makeFieldWriter(f, config));
          addFooterRow(fields, footerFields, reducerType, config, footerRow, enableOverrides, rowCount, writers);
        }
        // BMC Code: end
        csv += config.newline;
      }
    }

    // BMC Code: Start
    // Adding default limit of 5k records for PDF full table download to avoid high memory usage
    // and limit can be updated from the generator side through environment variable.
    let length = fields[0].values.length;
    if (length > rowsLimit && fullTable === 'true') {
      length = rowsLimit;
    }
    // BMC Code: end

    if (length > 0) {
      const writers = fields.map((field) => makeFieldWriter(field, config!));
      for (let i = 0; i < length; i++) {
        for (let j = 0; j < fields.length; j++) {
          // BMC Code: Start
          // Filtering hidden columns
          if (fields[j].config.custom && fields[j].config.custom.hidden) {
            continue;
          }
          // BMC Code: end
          if (j > 0 && atleastOneColumnFilled.data) {
            csv = csv + config.delimiter;
          }

          // BMC Code: Start
          // Apply delimiter only after first column (value) has been filled
          atleastOneColumnFilled.data = true;
          // BMC Code: end

          let v = fields[j].values[i];
          // For FieldType frame, use value if it exists to prevent exporting [object object]
          if (fields[j].type === FieldType.frame && fields[j].values[i].value) {
            v = fields[j].values[i].value;
          }

          // BMC Code: Start
          // Empty cell handling when enclosure='double' to avoid overrides
          if (config.enclosed === EnclosureMode.Double && (v === null || v === undefined || v === '')) {
            csv += writeValue(v, config!);
            continue;
          }
          // BMC Code: end

          if (v !== null || enableOverrides) {
            let str = writers[j](v);

            // BMC Code: Start
            // Add cell styling and hyperlink as meta tags in value
            if (enableOverrides) {
              // enableOverrides is true when the request is coming from renderer
              if (multilingualPdfEnabled && detectedScript === null) {
                detectedScript = detectScript(str);
              }
              str = v === null && fields[j]?.type === FieldType.time ? '' : str;
              str = getCellStyleWithValue(fields[j], str, i, config);
            }
            // BMC Code: end

            // Avoid csv injection
            // and a regression fix for #DRJ71-5603
            // and fix for special characters in date format
            str = str.replace(' ', ' ');
            str = str.replace('\u202F', ' ');

            if (str.startsWith('=')) {
              csv += str.replace('=', ' =');
              continue;
            }
            if (str.startsWith('"=')) {
              csv += str.replace('"=', '" =');
              continue;
            }

            if (str.startsWith('"@')) {
              csv += str.replace('"@', '" @');
              continue;
            }
            if (str.startsWith('@')) {
              csv += str.replace('@', ' @');
              continue;
            }
            // BMC Change: end
            csv += str;
          }
        }
        // BMC Code: Start
        // Apply delimiter only after first column (value) has been filled, rechecking this condition for every row
        atleastOneColumnFilled.data = false;
        // BMC Code: end
        if (i !== length - 1) {
          csv = csv + config.newline;
        }
      }
      // replace the field meta with field meta + detected language
      if (detectedScript && detectedScript !== 'latin' && detectedScript !== 'latinEx') {
        const languageMeta = `lang=${detectedScript}`;
        csv = csv.replaceAll('lang=latin', languageMeta);
      }
    }
    // BMC Code: Start
    if (footer) {
      csv += config.newline + footerRow.join(config.delimiter);
    }
    // BMC Code: end
    if (s !== data.length - 1) {
      csv = csv + config.newline;
    }
  }

  return csv;
}

const getMetaTagForField = (
  field: Field<any>,
  index: number,
  multilingualPdfEnabled: boolean,
  currentPanel?: any
): string => {
  const isBarcodeOrQR = field.config.custom?.type === 'barcode' || field.config.custom?.type === 'qrcode';
  const headerInfo = {
    type: isBarcodeOrQR ? field.config.custom.type : field.type,
    align: field.config.custom?.align ? field.config.custom?.align : field.config.custom?.alignment,
    colorType: field.config.custom?.cellOptions?.type,
    width: field.config?.custom?.width && field.config?.custom?.width !== 150 ? field.config?.custom?.width : undefined,
    format: field.config?.unit,
    headerColor: currentPanel?.options?.header?.headerColor,
    headerBgColor: currentPanel?.options?.header?.headerBgColor,
  };

  // Store header info in a string
  const meta = [];
  switch (headerInfo.type) {
    case 'barcode':
      meta.push('t=b');
      break;
    case 'time':
      meta.push('t=t');
      break;
    case 'number':
      meta.push('t=n');
      break;
    default:
      meta.push('t=s'); // default is string
  }
  switch (headerInfo.align) {
    case 'center':
      meta.push('al=c');
      break; // center
    case 'left':
      meta.push('al=l');
      break; // left
    case 'right':
      meta.push('al=r');
      break; // right
    default:
      meta.push('al=a'); // auto
  }
  switch (headerInfo.colorType) {
    case 'color-text':
      meta.push('ct=t');
      break; // text
    case 'color-background':
      meta.push('ct=b');
      break; // background
  }
  if (headerInfo.width) {
    meta.push(`w=${headerInfo.width}`);
  }
  if (headerInfo.format) {
    meta.push(`fmt=${headerInfo.format.replaceAll(' ', '{{bmc_space}}')}`); // data format
  }
  if (headerInfo.headerColor) {
    meta.push(`htc=${headerInfo.headerColor}`);
  }
  if (headerInfo.headerBgColor) {
    meta.push(`hbg=${headerInfo.headerBgColor}`);
  }

  if (multilingualPdfEnabled && headerInfo.type && index === 0) {
    meta.push(`lang=latin`);
  }

  return meta.join(' ');
};

const getCellStyleWithValue = (
  field: Field<any>,
  v: any,
  valueRowIndex: number,
  config: CSVConfig,
  isFooterRow = false
): string => {
  let str = v;
  let hasQuotes = false;
  try {
    if (str.startsWith('"') && str.endsWith('"')) {
      str = str.slice(1);
      str = str.slice(0, -1);
      hasQuotes = true;
    }

    // Store cell info in a string
    const meta = [];
    // The key should be actual value without prefix or suffix
    // BMC Code: Start
    const key = field.values[valueRowIndex];
    if (isFooterRow) {
      meta.push(`f=1`);
    } // BMC Code: end
    else if (field.display?.(key)?.color !== '') {
      let color = field.display?.(key)?.color;
      if (color && color.length > 7) {
        color = convertRGBAtoRGB(color);
      }
      meta.push(`c=${color}`);
    }

    const link = field.getLinks?.({ valueRowIndex });
    const length = link?.length ?? 0;
    if (length > 0) {
      const val = writeValueBMC(link![length - 1].href, config);
      if (val.hasQuotes) {
        hasQuotes = true;
      }
      meta.push(`u=${val.str}`);
    }

    const metaStr = meta.join(' ');
    if (hasQuotes) {
      return `"${str}[@meta@]${metaStr}"`;
    }

    return `${v}[@meta@]${metaStr}`;
  } catch (error) {
    console.error('Error while getting cell style string', error);
  }
  return v;
};

/**
 * This function handles substring which needs escaping for double quotes
 * And also returns a boolean flag to determine,
 * whether to wrap parent string in leading and trailing double quote
 * @returns {string, boolean}
 */
function writeValueBMC(substr: unknown, config: CSVConfig): { str: string; hasQuotes: boolean } {
  if (substr === null || substr === undefined) {
    return { str: '', hasQuotes: false };
  }
  const str = substr.toString();
  if (str.includes('"')) {
    // Escape the double quote characters
    return { str: str.replace(/"/gi, '""'), hasQuotes: true };
  }
  if (str.includes('\n') || (config.delimiter && str.includes(config.delimiter))) {
    return { str, hasQuotes: true };
  }
  return { str, hasQuotes: false };
}

/*
Adding this function to handle the alpha values (Opacity/Transparency) in RGBA to convert 
them into RGB color (similar color as excelize does not support RGBA values).
*/

function convertRGBAtoRGB(rgbaColor: string): string {
  const redColor = parseInt(rgbaColor.substring(1, 3), 16);
  const greenColor = parseInt(rgbaColor.substring(3, 5), 16);
  const blueColor = parseInt(rgbaColor.substring(5, 7), 16);
  const alphaColor = parseInt(rgbaColor.substring(7, 9), 16) / 255;

  //Background Color is considered as white (Will be used to combine with RGB color to adjust the opacity)
  const bgRed = 255;
  const bgGreen = 255;
  const bgBlue = 255;

  const alphaRed = ((1 - alphaColor) * bgRed + alphaColor * redColor) | 0;
  const alphaGreen = ((1 - alphaColor) * bgGreen + alphaColor * greenColor) | 0;
  const alphaBlue = ((1 - alphaColor) * bgBlue + alphaColor * blueColor) | 0;

  //Convert the alpha blended values to hex code
  const hexRed = alphaRed.toString(16).padStart(2, '0');
  const hexGreen = alphaGreen.toString(16).padStart(2, '0');
  const hexBlue = alphaBlue.toString(16).padStart(2, '0');

  const rgbColor = `#${hexRed}${hexGreen}${hexBlue}`;

  return rgbColor;
}
