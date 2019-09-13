import {
  ReducerID,
  reduceField,
  FieldType,
  DataFrame,
  FieldConfig,
  DisplayValue,
  GraphSeriesValue,
  DataFrameView,
  getTimeField,
  ScopedVars,
} from '@grafana/data';

import toNumber from 'lodash/toNumber';
import toString from 'lodash/toString';

import { GrafanaTheme, InterpolateFunction } from '../types/index';
import { getDisplayProcessor } from './displayProcessor';
import { getFlotPairs } from './flotPairs';
import { DataLinkBuiltInVars } from '../utils/dataLinks';

export interface FieldDisplayOptions {
  values?: boolean; // If true show each row value
  limit?: number; // if showing all values limit
  calcs: string[]; // when !values, pick one value for the whole field

  defaults: FieldConfig; // Use these values unless otherwise stated
  override: FieldConfig; // Set these values regardless of the source
}
// TODO: use built in variables, same as for data links?
export const VAR_SERIES_NAME = '__series_name';
export const VAR_FIELD_NAME = '__field_name';
export const VAR_CALC = '__calc';
export const VAR_CELL_PREFIX = '__cell_'; // consistent with existing table templates

function getTitleTemplate(title: string | undefined, stats: string[], data?: DataFrame[]): string {
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
  name: string; // The field name (title is in display)
  field: FieldConfig;
  display: DisplayValue;
  sparkline?: GraphSeriesValue[][];

  // Expose to the original values for delayed inspection (DataLinks etc)
  view?: DataFrameView;
  column?: number; // The field column index
  row?: number; // only filled in when the value is from a row (ie, not a reduction)
}

export interface GetFieldDisplayValuesOptions {
  data?: DataFrame[];
  fieldOptions: FieldDisplayOptions;
  replaceVariables: InterpolateFunction;
  sparkline?: boolean; // Calculate the sparkline
  theme: GrafanaTheme;
}

export const DEFAULT_FIELD_DISPLAY_VALUES_LIMIT = 25;

export const getFieldDisplayValues = (options: GetFieldDisplayValuesOptions): FieldDisplay[] => {
  const { data, replaceVariables, fieldOptions } = options;
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

      scopedVars[DataLinkBuiltInVars.seriesName] = { text: 'Series', value: series.name };

      const { timeField } = getTimeField(series);
      const view = new DataFrameView(series);

      for (let i = 0; i < series.fields.length && !hitLimit; i++) {
        const field = series.fields[i];

        // Show all number fields
        if (field.type !== FieldType.number) {
          continue;
        }
        const config = getFieldProperties(defaults, field.config || {}, override);

        let name = field.name;
        if (!name) {
          name = `Field[${s}]`;
        }

        scopedVars[VAR_FIELD_NAME] = { text: 'Field', value: name };

        const display = getDisplayProcessor({
          field: config,
          theme: options.theme,
        });

        const title = config.title ? config.title : defaultTitle;

        // Show all rows
        if (fieldOptions.values) {
          const usesCellValues = title.indexOf(VAR_CELL_PREFIX) >= 0;

          for (let j = 0; j < field.values.length; j++) {
            // Add all the row variables
            if (usesCellValues) {
              for (let k = 0; k < series.fields.length; k++) {
                const f = series.fields[k];
                const v = f.values.get(j);
                scopedVars[VAR_CELL_PREFIX + k] = {
                  value: v,
                  text: toString(v),
                };
              }
            }

            const displayValue = display(field.values.get(j));
            displayValue.title = replaceVariables(title, scopedVars);
            values.push({
              name,
              field: config,
              display: displayValue,
              view,
              column: i,
              row: j,
            });

            if (values.length >= limit) {
              hitLimit = true;
              break;
            }
          }
        } else {
          const results = reduceField({
            field,
            reducers: calcs, // The stats to calculate
          });
          let sparkline: GraphSeriesValue[][] | undefined = undefined;

          // Single sparkline for every reducer
          if (options.sparkline && timeField) {
            sparkline = getFlotPairs({
              xField: timeField,
              yField: series.fields[i],
            });
          }

          for (const calc of calcs) {
            scopedVars[VAR_CALC] = { value: calc, text: calc };
            const displayValue = display(results[calc]);
            displayValue.title = replaceVariables(title, scopedVars);
            values.push({
              name,
              field: config,
              display: displayValue,
              sparkline,
              view,
              column: i,
            });
          }
        }
      }
    }
  }

  if (values.length === 0) {
    values.push({
      name: 'No data',
      field: {
        ...defaults,
      },
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
export function applyFieldProperties(field: FieldConfig, props?: FieldConfig): FieldConfig {
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
  return copy as FieldConfig;
}

export function getFieldProperties(...props: FieldConfig[]): FieldConfig {
  let field = props[0] as FieldConfig;
  for (let i = 1; i < props.length; i++) {
    field = applyFieldProperties(field, props[i]);
  }

  // First value is always -Infinity
  if (field.thresholds && field.thresholds.length) {
    field.thresholds[0].value = -Infinity;
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
