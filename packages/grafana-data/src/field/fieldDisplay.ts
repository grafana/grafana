import toString from 'lodash/toString';
import isEmpty from 'lodash/isEmpty';

import { getDisplayProcessor } from './displayProcessor';
import { getFlotPairs } from '../utils/flotPairs';
import {
  DataFrame,
  DisplayValue,
  DisplayValueAlignmentFactors,
  Field,
  FieldConfig,
  FieldConfigSource,
  FieldType,
  InterpolateFunction,
  LinkModel,
  TimeZone,
} from '../types';
import { DataFrameView } from '../dataframe/DataFrameView';
import { GraphSeriesValue } from '../types/graph';
import { GrafanaTheme } from '../types/theme';
import { reduceField, ReducerID } from '../transformations/fieldReducer';
import { ScopedVars } from '../types/ScopedVars';
import { getTimeField } from '../dataframe/processDataFrame';
import { getFieldMatcher } from '../transformations';
import { FieldMatcherID } from '../transformations/matchers/ids';

/**
 * Options for how to turn DataFrames into an array of display values
 */
export interface ReduceDataOptions {
  /* If true show each row value */
  values?: boolean;
  /** if showing all values limit */
  limit?: number;
  /** When !values, pick one value for the whole field */
  calcs: string[];
  /** Which fields to show.  By default this is only numeric fields */
  fields?: string;
}

// TODO: use built in variables, same as for data links?
export const VAR_SERIES_NAME = '__series.name';
export const VAR_FIELD_NAME = '__field.name';
export const VAR_FIELD_LABELS = '__field.labels';
export const VAR_CALC = '__calc';
export const VAR_CELL_PREFIX = '__cell_'; // consistent with existing table templates

function getTitleTemplate(stats: string[]): string {
  const parts: string[] = [];
  if (stats.length > 1) {
    parts.push('${' + VAR_CALC + '}');
  }

  parts.push('${' + VAR_FIELD_NAME + '}');

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
  getLinks?: () => LinkModel[];
  hasLinks: boolean;
}

export interface GetFieldDisplayValuesOptions {
  data?: DataFrame[];
  reduceOptions: ReduceDataOptions;
  fieldConfig: FieldConfigSource;
  replaceVariables: InterpolateFunction;
  sparkline?: boolean; // Calculate the sparkline
  theme: GrafanaTheme;
  autoMinMax?: boolean;
  timeZone?: TimeZone;
}

export const DEFAULT_FIELD_DISPLAY_VALUES_LIMIT = 25;

export const getFieldDisplayValues = (options: GetFieldDisplayValuesOptions): FieldDisplay[] => {
  const { replaceVariables, reduceOptions, fieldConfig, timeZone } = options;
  const calcs = reduceOptions.calcs.length ? reduceOptions.calcs : [ReducerID.last];

  const values: FieldDisplay[] = [];
  const fieldMatcher = getFieldMatcher(
    reduceOptions.fields
      ? {
          id: FieldMatcherID.byRegexp,
          options: reduceOptions.fields,
        }
      : {
          id: FieldMatcherID.numeric,
        }
  );

  if (options.data) {
    // Field overrides are applied already
    const data = options.data;
    let hitLimit = false;
    const limit = reduceOptions.limit ? reduceOptions.limit : DEFAULT_FIELD_DISPLAY_VALUES_LIMIT;
    const scopedVars: ScopedVars = {};
    const defaultDisplayName = getTitleTemplate(calcs);

    for (let s = 0; s < data.length && !hitLimit; s++) {
      const series = data[s]; // Name is already set

      const { timeField } = getTimeField(series);
      const view = new DataFrameView(series);

      for (let i = 0; i < series.fields.length && !hitLimit; i++) {
        const field = series.fields[i];
        const fieldLinksSupplier = field.getLinks;

        // To filter out time field, need an option for this
        if (!fieldMatcher(field, series, data)) {
          continue;
        }

        const config = field.config; // already set by the prepare task
        const displayName = field.config.displayName ?? defaultDisplayName;

        const display =
          field.display ??
          getDisplayProcessor({
            field,
            theme: options.theme,
            timeZone,
          });

        // Show all rows
        if (reduceOptions.values) {
          const usesCellValues = displayName.indexOf(VAR_CELL_PREFIX) >= 0;

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
            displayValue.title = replaceVariables(displayName, {
              ...field.state?.scopedVars, // series and field scoped vars
              ...scopedVars,
            });

            values.push({
              name,
              field: config,
              display: displayValue,
              view,
              colIndex: i,
              rowIndex: j,
              getLinks: fieldLinksSupplier
                ? () =>
                    fieldLinksSupplier({
                      valueRowIndex: j,
                    })
                : () => [],
              hasLinks: hasLinks(field),
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
            displayValue.title = replaceVariables(displayName, {
              ...field.state?.scopedVars, // series and field scoped vars
              ...scopedVars,
            });

            values.push({
              name: calc,
              field: config,
              display: displayValue,
              sparkline,
              view,
              colIndex: i,
              getLinks: fieldLinksSupplier
                ? () =>
                    fieldLinksSupplier({
                      calculatedValue: displayValue,
                    })
                : () => [],
              hasLinks: hasLinks(field),
            });
          }
        }
      }
    }
  }

  if (values.length === 0) {
    values.push(createNoValuesFieldDisplay(options));
  } else if (values.length === 1 && !fieldConfig.defaults.displayName) {
    // Don't show title for single item
    values[0].display.title = undefined;
  }

  return values;
};

export function hasLinks(field: Field): boolean {
  return field.config?.links?.length ? field.config.links.length > 0 : false;
}

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
  const { fieldConfig, timeZone } = options;
  const { defaults } = fieldConfig;

  const displayProcessor = getDisplayProcessor({
    field: {
      type: FieldType.other,
      config: defaults,
    },
    theme: options.theme,
    timeZone,
  });

  const display = displayProcessor(null);
  const text = getDisplayText(display, displayName);

  return {
    name: displayName,
    field: {
      ...defaults,
      max: defaults.max ?? 0,
      min: defaults.min ?? 0,
    },
    display: {
      text,
      numeric: 0,
      color: display.color,
    },
    hasLinks: false,
  };
}

function getDisplayText(display: DisplayValue, fallback: string): string {
  if (!display || isEmpty(display.text)) {
    return fallback;
  }
  return display.text;
}
