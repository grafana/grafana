import { toString, isEmpty } from 'lodash';

import { DataFrameView } from '../dataframe/DataFrameView';
import { getTimeField } from '../dataframe/processDataFrame';
import { GrafanaTheme2 } from '../themes';
import { getFieldMatcher } from '../transformations';
import { reduceField, ReducerID } from '../transformations/fieldReducer';
import { FieldMatcherID } from '../transformations/matchers/ids';
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
  TimeRange,
  TimeZone,
} from '../types';
import { ScopedVars } from '../types/ScopedVars';

import { getDisplayProcessor } from './displayProcessor';
import { getFieldDisplayName } from './fieldState';

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
export const VAR_FIELD_NAME = '__field.displayName'; // Includes the rendered tags and naming strategy
export const VAR_FIELD_LABELS = '__field.labels';
export const VAR_CALC = '__calc';
export const VAR_CELL_PREFIX = '__cell_'; // consistent with existing table templates

export interface FieldSparkline {
  y: Field; // Y values
  x?: Field; // if this does not exist, use the index
  timeRange?: TimeRange; // Optionally force an absolute time
  highlightIndex?: number;
}

export interface FieldDisplay {
  name: string; // The field name (title is in display)
  field: FieldConfig;
  display: DisplayValue;
  sparkline?: FieldSparkline;

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
  theme: GrafanaTheme2;
  timeZone?: TimeZone;
}

export const DEFAULT_FIELD_DISPLAY_VALUES_LIMIT = 25;

export const getFieldDisplayValues = (options: GetFieldDisplayValuesOptions): FieldDisplay[] => {
  const { replaceVariables, reduceOptions, timeZone, theme } = options;
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

  const data = options.data ?? [];
  const limit = reduceOptions.limit ? reduceOptions.limit : DEFAULT_FIELD_DISPLAY_VALUES_LIMIT;
  const scopedVars: ScopedVars = {};

  let hitLimit = false;

  for (let s = 0; s < data.length && !hitLimit; s++) {
    const dataFrame = data[s]; // Name is already set

    const { timeField } = getTimeField(dataFrame);
    const view = new DataFrameView(dataFrame);

    for (let i = 0; i < dataFrame.fields.length && !hitLimit; i++) {
      const field = dataFrame.fields[i];
      const fieldLinksSupplier = field.getLinks;

      // To filter out time field, need an option for this
      if (!fieldMatcher(field, dataFrame, data)) {
        continue;
      }

      let config = field.config; // already set by the prepare task

      if (field.state?.range) {
        // Us the global min/max values
        config = {
          ...config,
          ...field.state?.range,
        };
      }

      const displayName = field.config.displayName ?? '';

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
            for (let k = 0; k < dataFrame.fields.length; k++) {
              const f = dataFrame.fields[k];
              const v = f.values.get(j);
              scopedVars[VAR_CELL_PREFIX + k] = {
                value: v,
                text: toString(v),
              };
            }
          }

          field.state = setIndexForPaletteColor(field, values.length);

          const displayValue = display(field.values.get(j));
          const rowName = getSmartDisplayNameForRow(dataFrame, field, j, replaceVariables, scopedVars);
          const overrideColor = lookupRowColorFromOverride(rowName, options.fieldConfig, theme);

          values.push({
            name: '',
            field: config,
            display: {
              ...displayValue,
              title: rowName,
              color: overrideColor ?? displayValue.color,
            },
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

        for (const calc of calcs) {
          scopedVars[VAR_CALC] = { value: calc, text: calc };
          const displayValue = display(results[calc]);

          if (displayName !== '') {
            displayValue.title = replaceVariables(displayName, {
              ...field.state?.scopedVars, // series and field scoped vars
              ...scopedVars,
            });
          } else {
            displayValue.title = getFieldDisplayName(field, dataFrame, data);
          }

          let sparkline: FieldSparkline | undefined = undefined;
          if (options.sparkline) {
            sparkline = {
              y: dataFrame.fields[i],
              x: timeField,
            };
            if (calc === ReducerID.last) {
              sparkline.highlightIndex = sparkline.y.values.length - 1;
            } else if (calc === ReducerID.first) {
              sparkline.highlightIndex = 0;
            }
          }

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

  if (values.length === 0) {
    values.push(createNoValuesFieldDisplay(options));
  }

  return values;
};

function getSmartDisplayNameForRow(
  frame: DataFrame,
  field: Field,
  rowIndex: number,
  replaceVariables: InterpolateFunction,
  scopedVars: ScopedVars
): string {
  let parts: string[] = [];
  let otherNumericFields = 0;

  if (field.config.displayName) {
    return replaceVariables(field.config.displayName, {
      ...field.state?.scopedVars, // series and field scoped vars
      ...scopedVars,
    });
  }

  for (const otherField of frame.fields) {
    if (otherField === field) {
      continue;
    }

    if (otherField.type === FieldType.string) {
      const value = otherField.values.get(rowIndex) ?? '';
      const mappedValue = otherField.display ? otherField.display(value).text : value;
      if (mappedValue.length > 0) {
        parts.push(mappedValue);
      }
    } else if (otherField.type === FieldType.number) {
      otherNumericFields++;
    }
  }

  if (otherNumericFields || parts.length === 0) {
    parts.push(getFieldDisplayName(field, frame));
  }

  return parts.join(' ');
}

/**
 * Palette color modes use series index (field index) which does not work for when displaing rows
 * So updating seriesIndex here makes the palette color modes work in "All values" mode
 */
function setIndexForPaletteColor(field: Field, currentLength: number) {
  return {
    ...field.state,
    seriesIndex: currentLength,
  };
}

/**
 * This function makes overrides that set color work for row values
 */
function lookupRowColorFromOverride(displayName: string, fieldConfig: FieldConfigSource, theme: GrafanaTheme2) {
  for (const override of fieldConfig.overrides) {
    if (override.matcher.id === 'byName' && override.matcher.options === displayName) {
      for (const prop of override.properties) {
        if (prop.id === 'color' && prop.value) {
          return theme.visualization.getColorByName(prop.value.fixedColor);
        }
      }
    }
  }

  return null;
}

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
