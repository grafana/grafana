import { Registry, RegistryItem } from '@grafana/data';

export enum FieldExtractorID {
  JSON = 'json',
  KeyValues = 'kvp',
  Auto = 'auto',
}

export interface FieldExtractor extends RegistryItem {
  parse: (v: string) => Record<string, any> | undefined;
}

const extJSON: FieldExtractor = {
  id: FieldExtractorID.JSON,
  name: 'JSON',
  description: 'Parse JSON string',
  parse: (v: string) => {
    return JSON.parse(v);
  },
};

// strips quotes and leading/trailing braces in prom labels
const stripDecor = /['"]|^\{|\}$/g;
// splits on whitespace and other label pair delimiters
const splitLines = /[\s,;&]+/g;
// splits kv pairs
const splitPair = /[=:]/g;
// finds all strings in single/double quotes
const quotedValues = /['"](.*?)['"]/g;
// finds the quoted value placeholder
const prefixRegex = /(\$val\d+\$)/g;

const extLabels: FieldExtractor = {
  id: FieldExtractorID.KeyValues,
  name: 'Key+value pairs',
  description: 'Look for a=b, c: d values in the line',
  parse: (v: string) => {
    const obj: Record<string, any> = {};
    const quotedValuesMap: Map<string, string> = new Map<string, string>();
    const placeholderPrefix = '$val';
    let quoteCounter = 0;
    v.trim()
      .replace(/[\r\n]/g, '')
      .replace(quotedValues, (matched) => {
        const placeholder = `${placeholderPrefix}${quoteCounter}$`;
        quotedValuesMap.set(placeholder, matched);
        quoteCounter++;
        return placeholder;
      })
      .replace(stripDecor, '')
      .split(splitLines)
      .forEach((pair, index, arr) => {
        if (pair.match(splitPair) === null) {
          pair = `${arr[index - 1]} ${pair}`;
          let counter = 0;
          let flipQuote = false;
          const matches = pair.match(prefixRegex)?.length;
          pair = pair.replace(stripDecor, '').replace(prefixRegex, (matched) => {
            let quotedValue = '';
            if (matches) {
              if (matches % 2 === 0) {
                if (counter % 2 === 0) {
                  quotedValue = `${matched}"`;
                } else {
                  quotedValue = `"${matched}`;
                }
              } else {
                if (counter % 2 === 0 && !flipQuote) {
                  quotedValue = `${matched}"`;
                  flipQuote = true;
                } else if (counter % 2 === 0 && flipQuote) {
                  quotedValue = `"${matched}`;
                  flipQuote = false;
                } else {
                  quotedValue = `"${matched}"`;
                }
              }
            }
            counter++;
            return quotedValue;
          });
          arr[index] = pair;
        }

        let [k, v] = pair.split(splitPair);

        k = k.replace(prefixRegex, (matched, _index) => {
          const originalValue = quotedValuesMap.get(matched);
          if (originalValue) {
            return originalValue.replace(stripDecor, '');
          }
          return matched;
        });

        v = v.replace(prefixRegex, (matched, _index) => {
          const originalValue = quotedValuesMap.get(matched);
          if (originalValue) {
            return originalValue.replace(stripDecor, '');
          }
          return matched;
        });
        if (k != null) {
          obj[k] = v;
        }
      });

    return obj;
  },
};

const fmts = [extJSON, extLabels];

const extAuto: FieldExtractor = {
  id: FieldExtractorID.Auto,
  name: 'Auto',
  description: 'parse new fields automatically',
  parse: (v: string) => {
    for (const f of fmts) {
      try {
        const r = f.parse(v);
        if (r != null) {
          return r;
        }
      } catch {} // ignore errors
    }
    return undefined;
  },
};

export const fieldExtractors = new Registry<FieldExtractor>(() => [...fmts, extAuto]);
