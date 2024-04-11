import { Registry, RegistryItem } from '@grafana/data';

import { FieldExtractorID } from './types';

export interface FieldExtractor extends RegistryItem {
  parse: (v: string, exp?: string, source?: string, transformationIndex?: number) => Record<string, any> | undefined;
}

const extJSON: FieldExtractor = {
  id: FieldExtractorID.JSON,
  name: 'JSON',
  description: 'Parse JSON string',
  parse: (v: string) => {
    return JSON.parse(v);
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
      case `\n`:
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
  parse: parseKeyValuePairs,
};

const extRegex: FieldExtractor = {
  id: FieldExtractorID.Regex,
  name: 'Regex',
  description: 'Parse with Regex',
  parse: (v: string, exp?: string, source?: string, transformationIndex?: number) => {
    if (exp) {
      try {
        const re = new RegExp(exp, 'gi');
        const matches = Array.from(v.matchAll(re));

        // move group matches to an easier to deal with structure
        const matchGroups: { [key: string]: string[] } = {};
        matches.forEach((match, matchIdx) => {
          const group = match.groups;
          if (group) {
            const groupKeys = Object.keys(group);
            groupKeys.forEach((groupKey) => {
              if (group[groupKey] !== undefined) {
                if (matchGroups[groupKey] === undefined) {
                  matchGroups[groupKey] = [group[groupKey]];
                } else {
                  matchGroups[groupKey].push(group[groupKey]);
                }
              }
            });
          } else {
            const matchIndex = `${source}-${transformationIndex}-${matchIdx}`;
            matchGroups[matchIndex] = [match[0]];
          }
        });

        const fields: { [key: string]: string } = {};
        Object.keys(matchGroups).forEach((key) => {
          matchGroups[key].forEach((value, i) => {
            // 0 should count as blank, every higher index is - 1
            const index = matchGroups[key].length > 1 && i !== 0 ? `${key}-${i - 1}` : key;
            fields[index] = value;
          });
        });
        return fields;
      } catch {
        return undefined;
      }
    } else {
      return undefined;
    }
  },
};

const fmts = [extJSON, extLabels, extRegex];
const autoFormats = [extJSON, extLabels]; // regular expression cannot be parsed automatically

const extAuto: FieldExtractor = {
  id: FieldExtractorID.Auto,
  name: 'Auto',
  description: 'parse new fields automatically',
  parse: (v: string) => {
    for (const f of autoFormats) {
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
