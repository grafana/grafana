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

const strip = /^[ '"]|[ '"]$/g;

/** Strips any leading or trailing decoration */
function sanitize(v: string): string {
  return v.replace(strip, '');
}

const regexp = new RegExp('[ ,;&\n]', 'g');
const extLabels: FieldExtractor = {
  id: FieldExtractorID.KeyValues,
  name: 'Key+value pairs',
  description: 'Look for a=b, c: d values in the line',
  parse: (v: string) => {
    const obj: Record<string, any> = {};
    for (const part of v.split(regexp)) {
      let idx = part.indexOf('=');
      if (idx < 0) {
        idx = part.indexOf(':');
      }
      if (idx > 0) {
        const k = sanitize(part.substring(0, idx));
        const v = sanitize(part.substring(idx + 1));
        obj[k] = v;
      }
    }
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
