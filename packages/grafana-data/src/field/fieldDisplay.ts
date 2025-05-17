import { isEmpty } from 'lodash';

import { DataFrameView } from '../dataframe/DataFrameView';
import { getTimeField } from '../dataframe/processDataFrame';
import { GrafanaTheme2 } from '../themes/types';
import { reduceField, ReducerID } from '../transformations/fieldReducer';
import { getFieldMatcher } from '../transformations/matchers';
import { FieldMatcherID } from '../transformations/matchers/ids';
import { ScopedVars } from '../types/ScopedVars';
import { DataFrame, Field, FieldConfig, FieldType } from '../types/dataFrame';
import { LinkModel } from '../types/dataLink';
import { DisplayValue, DisplayValueAlignmentFactors } from '../types/displayValue';
import { FieldConfigSource } from '../types/fieldOverrides';
import { InterpolateFunction } from '../types/panel';
import { TimeRange, TimeZone } from '../types/time';

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
  percentChange?: boolean; // Calculate percent change
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

      let displayName = field.config.displayName ?? '';

      const display =
        field.display ??
        getDisplayProcessor({
          field,
          theme: options.theme,
          timeZone,
        });

      // Show all rows
      if (reduceOptions.values) {
        for (let j = 0; j < field.values.length; j++) {
          field.state = setIndexForPaletteColor(field, values.length);

          const scopedVars = getFieldScopedVarsWithDataContexAndRowIndex(field, j);
          const displayValue = display(field.values[j]);
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
          const scopedVars = field.state?.scopedVars ?? {};
          scopedVars[VAR_CALC] = { value: calc, text: calc };

          const displayValue = display(results[calc]);

          if (displayName !== '') {
            displayValue.title = replaceVariables(displayName, scopedVars);
          } else {
            displayValue.title = getFieldDisplayName(field, dataFrame, data);
          }
          displayValue.percentChange = options.percentChange
            ? reduceField({ field: field, reducers: [ReducerID.diffperc] }).diffperc
            : undefined;

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

          // If there is only one row in the data frame, then set the
          // valueRowIndex to that one row. This allows the data macros in
          // things like links to access other fields from the data frame.
          //
          // If there were more rows, it still may be sane to set the row
          // index, but it may be confusing; the calculation may have
          // selected a value from a different row or it may have aggregated
          // the values from multiple rows, so to make just the first row
          // available would be arbitrary. For now, the users will have to
          // ensure that the data frame has just one row if they want data
          // link referencing other fields to work.
          //
          // TODO: A more complete solution here would be to allow the
          // calculation to report a relevant row and use that value. For
          // example, a common calculation is 'lastNotNull'. It'd be nifty to
          // know which row the display value corresponds to in that case if
          // there were potentially many
          const valueRowIndex = dataFrame.length === 1 ? 0 : undefined;

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
                    valueRowIndex,
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
  scopedVars: ScopedVars | undefined
): string {
  const displayName = field.config.displayName;

  if (displayName) {
    // Handle old __cell_n syntax
    if (displayName.indexOf(VAR_CELL_PREFIX)) {
      return replaceVariables(fixCellTemplateExpressions(displayName), scopedVars);
    }

    return replaceVariables(displayName, scopedVars);
  }

  let parts: string[] = [];
  let otherNumericFields = 0;

  for (const otherField of frame.fields) {
    if (otherField === field) {
      continue;
    }

    if (otherField.type === FieldType.string) {
      const value = otherField.values[rowIndex] ?? '';
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
  let maxTitle = '';
  let maxText = '';
  let maxPrefix = '';
  let maxSuffix = '';

  for (let i = 0; i < values.length; i++) {
    const v = values[i].display;

    if (v.text && v.text.length > maxText.length) {
      maxText = v.text;
    }

    if (v.title && v.title.length > maxTitle.length) {
      maxTitle = v.title;
    }

    if (v.prefix && v.prefix.length > maxPrefix.length) {
      maxPrefix = v.prefix;
    }

    if (v.suffix && v.suffix.length > maxSuffix.length) {
      maxSuffix = v.suffix;
    }
  }

  return { text: maxText, title: maxTitle, suffix: maxSuffix, prefix: maxPrefix };
}

function createNoValuesFieldDisplay(options: GetFieldDisplayValuesOptions): FieldDisplay {
  const displayName = 'No data';
  const { fieldConfig, timeZone } = options;
  const { defaults } = fieldConfig;

  const displayProcessor = getDisplayProcessor({
    field: {
      name: '',
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

export function fixCellTemplateExpressions(str: string) {
  return str.replace(
    /\${__cell_(\d+)(.*?)}|\[\[__cell_(\d+)(.*?)\]\]|\$__cell_(\d+)(\S*)/g,
    (match, cellNum1, fmt1, cellNum2, fmt2, cellNum3, fmt3) => {
      return `\${__data.fields[${cellNum1 ?? cellNum2 ?? cellNum3}]${fmt1 ?? fmt2 ?? fmt3}}`;
    }
  );
}

/**
 * Clones the existing dataContext and adds rowIndex to it
 */
function getFieldScopedVarsWithDataContexAndRowIndex(field: Field, rowIndex: number): ScopedVars | undefined {
  if (field.state?.scopedVars?.__dataContext) {
    return {
      ...field.state?.scopedVars,
      __dataContext: {
        value: {
          ...field.state?.scopedVars?.__dataContext.value,
          rowIndex,
        },
      },
    };
  }

  return field.state?.scopedVars;
}
