import { escapeStringForRegex, Registry, RegistryItem, stringStartsAsRegEx, stringToJsRegex } from '@grafana/data';

import { ExtractFieldsOptions, FieldExtractorID } from './types';

type Parser = (v: string) => Record<string, any> | undefined;

export interface FieldExtractor extends RegistryItem {
  getParser: (opts: ExtractFieldsOptions) => Parser;
}

const extJSON: FieldExtractor = {
  id: FieldExtractorID.JSON,
  name: 'JSON',
  description: 'Parse JSON string',
  getParser: (options) => (v: string) => {
    return JSON.parse(v);
  },
};

const extRegExp: FieldExtractor = {
  id: FieldExtractorID.RegExp,
  name: 'RegExp',
  description: 'Parse with RegExp',
  getParser: (options) => {
    let regex: RegExp | null = /(?<NewField>.*)/;

    if (stringStartsAsRegEx(options.regExp!)) {
      try {
        regex = stringToJsRegex(options.regExp!);
      } catch (error) {
        if (error instanceof Error) {
          console.warn(error.message);
        }
      }
    }

    return (v: string) => v.match(regex)?.groups;
  },
};

function parseKeyValuePairs(raw: string): Record<string, string> {
  const buff: string[] = []; // array of characters
  let esc = '';
  let key = '';
  const obj: Record<string, string> = {};
  for (let i = 0; i < raw.length; i++) {
    let c = raw[i];
    if (c === esc) {
      esc = '';
      c = raw[++i];
    }

    const isEscaped = c === '\\';
    if (isEscaped) {
      c = raw[++i];
    }

    // When escaped just append
    if (isEscaped || esc.length) {
      buff.push(c);
      continue;
    }

    if (c === `"` || c === `'`) {
      esc = c;
    }

    switch (c) {
      case ':':
      case '=':
        if (buff.length) {
          if (key) {
            obj[key] = '';
          }
          key = buff.join('');
          buff.length = 0; // clear values
        }
        break;

      // escape chars
      case `"`:
      case `'`:
      // whitespace
      case ` `:
      case `\t`:
      case `\r`:
      case `\n`:
        if (buff.length && key === '') {
          obj[buff.join('')] = '';
          buff.length = 0;
        }
      // seperators
      case ',':
      case ';':
      case '&':
      case '{':
      case '}':
        if (buff.length) {
          const val = buff.join('');
          if (key.length) {
            obj[key] = val;
            key = '';
          } else {
            key = val;
          }
          buff.length = 0; // clear values
        }
        break;

      // append our buffer
      default:
        buff.push(c);
        if (i === raw.length - 1) {
          if (key === '' && buff.length) {
            obj[buff.join('')] = '';
            buff.length = 0;
          }
        }
    }
  }

  if (key.length) {
    obj[key] = buff.join('');
  }
  return obj;
}

const extLabels: FieldExtractor = {
  id: FieldExtractorID.KeyValues,
  name: 'Key+value pairs',
  description: 'Look for a=b, c: d values in the line',
  getParser: (options) => parseKeyValuePairs,
};

const extDelimiter: FieldExtractor = {
  id: FieldExtractorID.Delimiter,
  name: 'Split by delimiter',
  description: 'Splits at delimited values, such as commas',
  getParser: ({ delimiter = ',' }) => {
    // Match for delimiter with surrounding whitesapce (\s)
    const splitRegExp = new RegExp(`\\s*${escapeStringForRegex(delimiter)}\\s*`, 'g');

    return (raw: string) => {
      // Try to split delimited values
      const parts = raw.trim().split(splitRegExp);
      const acc: Record<string, number> = {};
      for (const part of parts) {
        acc[part] = 1;
      }
      return acc;
    };
  },
};

const fmts = [extJSON, extLabels, extDelimiter, extRegExp];

const extAuto: FieldExtractor = {
  id: FieldExtractorID.Auto,
  name: 'Auto',
  description: 'parse new fields automatically',
  getParser: (options) => {
    const parsers = fmts.map((fmt) => fmt.getParser(options));

    return (v: string) => {
      for (const parse of parsers) {
        try {
          const r = parse(v);
          if (r != null) {
            return r;
          }
        } catch {} // ignore errors
      }
      return undefined;
    };
  },
};

export const fieldExtractors = new Registry<FieldExtractor>(() => [...fmts, extAuto]);
