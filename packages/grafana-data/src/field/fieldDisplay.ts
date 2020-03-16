import toString from 'lodash/toString';
import isEmpty from 'lodash/isEmpty';

import { getDisplayProcessor } from './displayProcessor';
import { getFlotPairs } from '../utils/flotPairs';
import {
  FieldConfig,
  DataFrame,
  FieldType,
  DisplayValue,
  DisplayValueAlignmentFactors,
  FieldConfigSource,
  InterpolateFunction,
} from '../types';
import { DataFrameView } from '../dataframe/DataFrameView';
import { GraphSeriesValue } from '../types/graph';
import { GrafanaTheme } from '../types/theme';
import { ReducerID, reduceField } from '../transformations/fieldReducer';
import { ScopedVars } from '../types/ScopedVars';
import { getTimeField } from '../dataframe/processDataFrame';
import { applyFieldOverrides } from './fieldOverrides';

export interface FieldDisplayOptions extends FieldConfigSource {
  values?: boolean; // If true show each row value
  limit?: number; // if showing all values limit
  calcs: string[]; // when !values, pick one value for the whole field
}

// TODO: use built in variables, same as for data links?
export const VAR_SERIES_NAME = '__series.name';
export const VAR_FIELD_NAME = '__field.name';
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
    parts.push('${' + VAR_CALC + '}');
  }
  if (data.length > 1) {
    parts.push('${' + VAR_SERIES_NAME + '}');
  }
  if (fieldCount > 1 || !parts.length) {
    parts.push('${' + VAR_FIELD_NAME + '}');
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
  colIndex?: number; // The field column index
  rowIndex?: number; // only filled in when the value is from a row (ie, not a reduction)
}

export interface GetFieldDisplayValuesOptions {
  data?: DataFrame[];
  fieldOptions: FieldDisplayOptions;
  replaceVariables: InterpolateFunction;
  sparkline?: boolean; // Calculate the sparkline
  theme: GrafanaTheme;
  autoMinMax?: boolean;
}

export const DEFAULT_FIELD_DISPLAY_VALUES_LIMIT = 25;

export const getFieldDisplayValues = (options: GetFieldDisplayValuesOptions): FieldDisplay[] => {
  const { replaceVariables, fieldOptions } = options;
  const calcs = fieldOptions.calcs.length ? fieldOptions.calcs : [ReducerID.last];

  const values: FieldDisplay[] = [];

  if (options.data) {
    const data = applyFieldOverrides(options);

    let hitLimit = false;
    const limit = fieldOptions.limit ? fieldOptions.limit : DEFAULT_FIELD_DISPLAY_VALUES_LIMIT;
    const defaultTitle = getTitleTemplate(fieldOptions.defaults.title, calcs, data);
    const scopedVars: ScopedVars = {};

    for (let s = 0; s < data.length && !hitLimit; s++) {
      const series = data[s]; // Name is already set

      const { timeField } = getTimeField(series);
      const view = new DataFrameView(series);

      for (let i = 0; i < series.fields.length && !hitLimit; i++) {
        const field = series.fields[i];

        // Show all number fields
        if (field.type !== FieldType.number) {
          continue;
        }
        const config = field.config; // already set by the prepare task

        const display =
          field.display ??
          getDisplayProcessor({
            field,
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
            displayValue.title = replaceVariables(title, {
              ...field.config.scopedVars, // series and field scoped vars
              ...scopedVars,
            });

            values.push({
              name,
              field: config,
              display: displayValue,
              view,
              colIndex: i,
              rowIndex: j,
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
            displayValue.title = replaceVariables(title, {
              ...field.config.scopedVars, // series and field scoped vars
              ...scopedVars,
            });
            values.push({
              name: calc,
              field: config,
              display: displayValue,
              sparkline,
              view,
              colIndex: i,
            });
          }
        }
      }
    }
  }

  if (values.length === 0) {
    values.push(createNoValuesFieldDisplay(options));
  } else if (values.length === 1 && !fieldOptions.defaults.title) {
    // Don't show title for single item
    values[0].display.title = undefined;
  }

  return values;
};

export function getDisplayValueAlignmentFactors(values: FieldDisplay[]): DisplayValueAlignmentFactors {
  const info: DisplayValueAlignmentFactors = {
    title: '',
    text: '',
  };

  let prefixLength = 0;
  let suffixLength = 0;

  for (let i = 0; i < values.length; i++) {
    const v = values[i].display;

    if (v.text && v.text.length > info.text.length) {
      info.text = v.text;
    }

    if (v.title && v.title.length > info.title.length) {
      info.title = v.title;
    }

    if (v.prefix && v.prefix.length > prefixLength) {
      info.prefix = v.prefix;
      prefixLength = v.prefix.length;
    }

    if (v.suffix && v.suffix.length > suffixLength) {
      info.suffix = v.suffix;
      suffixLength = v.suffix.length;
    }
  }
  return info;
}

function createNoValuesFieldDisplay(options: GetFieldDisplayValuesOptions): FieldDisplay {
  const displayName = 'No data';
  const { fieldOptions } = options;
  const { defaults } = fieldOptions;

  const displayProcessor = getDisplayProcessor({
    field: {
      type: FieldType.other,
      config: defaults,
    },
    theme: options.theme,
  });

  const display = displayProcessor(null);
  const text = getDisplayText(display, displayName);

  return {
    name: displayName,
    field: {
      ...defaults,
    },
    display: {
      text,
      numeric: 0,
      color: display.color,
    },
  };
}

function getDisplayText(display: DisplayValue, fallback: string): string {
  if (!display || isEmpty(display.text)) {
    return fallback;
  }
  return display.text;
}
