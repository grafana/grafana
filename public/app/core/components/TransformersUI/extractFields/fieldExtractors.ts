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

const extLabels: FieldExtractor = {
  id: FieldExtractorID.KeyValues,
  name: 'Key+value pairs',
  description: 'Look for a=b, c: d values in the line',
  parse: (v: string) => {
    const obj: Record<string, any> = {};

    v.trim()
      .replace(stripDecor, '')
      .split(splitLines)
      .forEach((pair) => {
        let [k, v] = pair.split(splitPair);

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
