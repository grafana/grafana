import toNumber from 'lodash/toNumber';
import toString from 'lodash/toString';

import {
  ValueMapping,
  Threshold,
  DisplayValue,
  FieldType,
  NullValueMode,
  GrafanaTheme,
  SeriesData,
  InterpolateFunction,
  Field,
  ScopedVars,
  GraphSeriesValue,
} from '../types/index';
import { getDisplayProcessor } from './displayValue';
import { getFlotPairs } from './flotPairs';
import { ReducerID, reduceField } from './fieldReducer';

export interface FieldDisplayOptions {
  values?: boolean; // If true show each row value
  limit?: number; // if showing all values limit
  calcs: string[]; // when !values, pick one value for the whole field

  defaults: Partial<Field>; // Use these values unless otherwise stated
  override: Partial<Field>; // Set these values regardless of the source

  // Could these be data driven also?
  thresholds: Threshold[];
  mappings: ValueMapping[];
}

export const VAR_SERIES_NAME = '__series_name';
export const VAR_FIELD_NAME = '__field_name';
export const VAR_CALC = '__calc';
export const VAR_CELL_PREFIX = '__cell_'; // consistent with existing table templates

function getTitleTemplate(title: string | undefined, stats: string[], data?: SeriesData[]): string {
  // If the title exists, use it as a template variable
  if (title) {
    return title;
  }
  if (!data || !data.length) {
    return 'No Data';
  }

  let fieldCount = 0;
  for (const field of data[0].fields) {
    if (field.type === FieldType.number) {
      fieldCount++;
    }
  }

  const parts: string[] = [];
  if (stats.length > 1) {
    parts.push('$' + VAR_CALC);
  }
  if (data.length > 1) {
    parts.push('$' + VAR_SERIES_NAME);
  }
  if (fieldCount > 1 || !parts.length) {
    parts.push('$' + VAR_FIELD_NAME);
  }
  return parts.join(' ');
}

export interface FieldDisplay {
  field: Field;
  display: DisplayValue;
  sparkline?: GraphSeriesValue[][];
}

export interface GetFieldDisplayValuesOptions {
  data?: SeriesData[];
  fieldOptions: FieldDisplayOptions;
  replaceVariables: InterpolateFunction;
  sparkline?: boolean; // Calculate the sparkline
  theme: GrafanaTheme;
}

export const DEFAULT_FIELD_DISPLAY_VALUES_LIMIT = 25;

export const getFieldDisplayValues = (options: GetFieldDisplayValuesOptions): FieldDisplay[] => {
  const { data, replaceVariables, fieldOptions, sparkline } = options;
  const { defaults, override } = fieldOptions;
  const calcs = fieldOptions.calcs.length ? fieldOptions.calcs : [ReducerID.last];

  const values: FieldDisplay[] = [];

  if (data) {
    let hitLimit = false;
    const limit = fieldOptions.limit ? fieldOptions.limit : DEFAULT_FIELD_DISPLAY_VALUES_LIMIT;
    const defaultTitle = getTitleTemplate(fieldOptions.defaults.title, calcs, data);
    const scopedVars: ScopedVars = {};

    for (let s = 0; s < data.length && !hitLimit; s++) {
      let series = data[s];
      if (!series.name) {
        series = {
          ...series,
          name: series.refId ? series.refId : `Series[${s}]`,
        };
      }
      scopedVars[VAR_SERIES_NAME] = { text: 'Series', value: series.name };

      let timeColumn = -1;
      if (sparkline) {
        for (let i = 0; i < series.fields.length; i++) {
          if (series.fields[i].type === FieldType.time) {
            timeColumn = i;
            break;
          }
        }
      }

      for (let i = 0; i < series.fields.length && !hitLimit; i++) {
        const field = getFieldProperties(defaults, series.fields[i], override);

        // Show all number fields
        if (field.type !== FieldType.number) {
          continue;
        }

        if (!field.name) {
          field.name = `Field[${s}]`; // it is a copy, so safe to edit
        }

        scopedVars[VAR_FIELD_NAME] = { text: 'Field', value: field.name };

        const display = getDisplayProcessor({
          field,
          mappings: fieldOptions.mappings,
          thresholds: fieldOptions.thresholds,
          theme: options.theme,
        });

        const title = field.title ? field.title : defaultTitle;

        // Show all number fields
        if (fieldOptions.values) {
          const usesCellValues = title.indexOf(VAR_CELL_PREFIX) >= 0;

          for (const row of series.rows) {
            // Add all the row variables
            if (usesCellValues) {
              for (let j = 0; j < series.fields.length; j++) {
                scopedVars[VAR_CELL_PREFIX + j] = {
                  value: row[j],
                  text: toString(row[j]),
                };
              }
            }

            const displayValue = display(row[i]);
            displayValue.title = replaceVariables(title, scopedVars);
            values.push({
              field,
              display: displayValue,
            });

            if (values.length >= limit) {
              hitLimit = true;
              break;
            }
          }
        } else {
          const results = reduceField({
            series,
            fieldIndex: i,
            reducers: calcs, // The stats to calculate
            nullValueMode: NullValueMode.Null,
          });

          // Single sparkline for a field
          const points =
            timeColumn < 0
              ? undefined
              : getFlotPairs({
                  series,
                  xIndex: timeColumn,
                  yIndex: i,
                  nullValueMode: NullValueMode.Null,
                });

          for (const calc of calcs) {
            scopedVars[VAR_CALC] = { value: calc, text: calc };
            const displayValue = display(results[calc]);
            displayValue.title = replaceVariables(title, scopedVars);
            values.push({
              field,
              display: displayValue,
              sparkline: points,
            });
          }
        }
      }
    }
  }

  if (values.length === 0) {
    values.push({
      field: { name: 'No Data' },
      display: {
        numeric: 0,
        text: 'No data',
      },
    });
  } else if (values.length === 1 && !fieldOptions.defaults.title) {
    // Don't show title for single item
    values[0].display.title = undefined;
  }

  return values;
};

const numericFieldProps: any = {
  decimals: true,
  min: true,
  max: true,
};

/**
 * Returns a version of the field with the overries applied.  Any property with
 * value: null | undefined | empty string are skipped.
 *
 * For numeric values, only valid numbers will be applied
 * for units, 'none' will be skipped
 */
export function applyFieldProperties(field: Field, props?: Partial<Field>): Field {
  if (!props) {
    return field;
  }
  const keys = Object.keys(props);
  if (!keys.length) {
    return field;
  }
  const copy = { ...field } as any; // make a copy that we will manipulate directly
  for (const key of keys) {
    const val = (props as any)[key];
    if (val === null || val === undefined) {
      continue;
    }

    if (numericFieldProps[key]) {
      const num = toNumber(val);
      if (!isNaN(num)) {
        copy[key] = num;
      }
    } else if (val) {
      // skips empty string
      if (key === 'unit' && val === 'none') {
        continue;
      }
      copy[key] = val;
    }
  }
  return copy as Field;
}

type PartialField = Partial<Field>;

export function getFieldProperties(...props: PartialField[]): Field {
  let field = props[0] as Field;
  for (let i = 1; i < props.length; i++) {
    field = applyFieldProperties(field, props[i]);
  }

  // Verify that max > min
  if (field.hasOwnProperty('min') && field.hasOwnProperty('max') && field.min! > field.max!) {
    return {
      ...field,
      min: field.max,
      max: field.min,
    };
  }
  return field;
}
