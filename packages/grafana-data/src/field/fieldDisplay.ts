import toString from 'lodash/toString';
import isEmpty from 'lodash/isEmpty';

import { getDisplayProcessor } from './displayProcessor';
import { getFlotPairs } from '../utils/flotPairs';
import {
  DataFrame,
  DisplayValue,
  DisplayValueAlignmentFactors,
  FieldConfig,
  FieldConfigSource,
  FieldType,
  InterpolateFunction,
  LinkModel,
  TimeZone,
  Field,
} from '../types';
import { DataFrameView } from '../dataframe/DataFrameView';
import { GraphSeriesValue } from '../types/graph';
import { GrafanaTheme } from '../types/theme';
import { reduceField, ReducerID } from '../transformations/fieldReducer';
import { ScopedVars } from '../types/ScopedVars';
import { getTimeField } from '../dataframe/processDataFrame';
import { formatLabels } from '../utils';

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
}

// TODO: use built in variables, same as for data links?
export const VAR_SERIES_NAME = '__series.name';
export const VAR_FIELD_NAME = '__field.name';
export const VAR_FIELD_LABELS = '__field.labels';
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
  parts.push('${' + VAR_FIELD_LABELS + '}');

  return parts.join(' ');
}

/**
 * Get an appropriate display title
 */
export function getFrameDisplayTitle(frame: DataFrame, index?: number) {
  if (frame.name) {
    return frame.name;
  }

  // Single field with tags
  const valuesWithLabels = frame.fields.filter(f => f.labels !== undefined);
  if (valuesWithLabels.length === 1) {
    return formatLabels(valuesWithLabels[0].labels!);
  }

  // list all the
  if (index === undefined) {
    return frame.fields
      .filter(f => f.type !== FieldType.time)
      .map(f => getFieldDisplayTitle(f, frame))
      .join(', ');
  }

  if (frame.refId) {
    return `Series (${frame.refId})`;
  }

  return `Series (${index})`;
}

/**
 * Get an appropriate display title.  If the 'title' is set, use that
 */
export function getFieldDisplayTitle(field: Field, frame?: DataFrame) {
  let title = field.config?.title;
  if (title) {
    return title; // Title is set and not a template
  }

  const id = getFieldId(field);
  const seriesName = frame?.name;
  if (seriesName && name !== seriesName) {
    return seriesName + ' ' + name;
  }
  return id;
}

/**
 * name + labels
 */
export function getFieldId(field: Field) {
  let name = field.config?.title ?? field.name;

  if (field.labels) {
    name += formatLabels(field.labels);
  }
  return name;
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

  if (options.data) {
    // Field overrides are applied already
    const data = options.data;
    let hitLimit = false;
    const limit = reduceOptions.limit ? reduceOptions.limit : DEFAULT_FIELD_DISPLAY_VALUES_LIMIT;
    const defaultTitle = getTitleTemplate(fieldConfig.defaults.title, calcs, data);
    const scopedVars: ScopedVars = {};

    for (let s = 0; s < data.length && !hitLimit; s++) {
      const series = data[s]; // Name is already set

      const { timeField } = getTimeField(series);
      const view = new DataFrameView(series);

      for (let i = 0; i < series.fields.length && !hitLimit; i++) {
        const field = series.fields[i];
        const fieldLinksSupplier = field.getLinks;
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
            timeZone,
          });

        const title = config.title ? config.title : defaultTitle;
        // Show all rows
        if (reduceOptions.values) {
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
              getLinks: fieldLinksSupplier
                ? () =>
                    fieldLinksSupplier({
                      valueRowIndex: j,
                    })
                : () => [],
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
              getLinks: fieldLinksSupplier
                ? () =>
                    fieldLinksSupplier({
                      calculatedValue: displayValue,
                    })
                : () => [],
            });
          }
        }
      }
    }
  }

  if (values.length === 0) {
    values.push(createNoValuesFieldDisplay(options));
  } else if (values.length === 1 && !fieldConfig.defaults.title) {
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
