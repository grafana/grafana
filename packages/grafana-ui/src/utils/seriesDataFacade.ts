import { SeriesData, Field } from '../types/data';
import { KeyValue } from '../types/index';

export interface SeriesFacadeIterator<T> {
  value: T; // object that behaves like T

  next: () => T;
  getRowData: () => any[];
  getRowIndex: () => number;
  getSeriesFields: () => Field[];
  getAdditionalFields: () => Field[];
  getAdditionalValues: () => any[];
}

export interface FacadeDefinition<T> {
  fields: Field[];
}

export function getSeriesDataFacade<T>(series: SeriesData, facade: FacadeDefinition<T>) {
  const aditionalFields: Field[] = [];
  const aditionalIndicies: number[] = [];
  let index = 0;
  let row = series.rows[index];

  const byName: KeyValue<UsedFieldInfo> = {};
  for (const f of facade.fields) {
    byName[f.name] = {
      found: false,
      field: f,
    };
  }

  const value = ({} as unknown) as T;
  for (let i = 0; i < series.fields.length; i++) {
    const field = series.fields[i];
    if (byName[field.name]) {
      if (byName[field.name].field.type !== field.type) {
        throw new Error('type mismatch????');
      }
      byName[field.name].found = true;
      Object.defineProperty(value, field.name, {
        get: () => {
          if (!row) {
            return undefined;
          }
          return row[i];
        },
      });
    } else {
      aditionalFields.push(field);
      aditionalIndicies.push(index);
    }
  }

  // abort if we don't have the same fields
  for (const f of Object.values(byName)) {
    if (!f.found) {
      throw new Error('Missing field: ' + f.field.name);
    }
  }

  return {
    value: series.rows.length ? value : undefined,

    next: () => {
      row = series.rows[index++];
      return value;
    },

    hasNext: () => {
      return index < series.rows.length;
    },

    getRowData: () => {
      return series.rows[index];
    },

    getRowIndex: () => {
      return index;
    },

    getSeriesFields: () => {
      return series.fields;
    },

    getAdditionalFields: () => {
      return aditionalFields;
    },

    getAdditionalValues: () => {
      return aditionalIndicies.map(idx => {
        return row ? row[idx] : undefined;
      });
    },
  };
}

interface UsedFieldInfo {
  field: Field;
  found: boolean;
}
