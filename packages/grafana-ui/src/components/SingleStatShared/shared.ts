import cloneDeep from 'lodash/cloneDeep';
import {
  ValueMapping,
  Threshold,
  VizOrientation,
  PanelModel,
  DisplayValue,
  FieldType,
  NullValueMode,
  GrafanaTheme,
  SeriesData,
  InterpolateFunction,
  Field,
  ScopedVars,
  GraphSeriesValue,
} from '../../types';
import { getStatsCalculators, calculateStats, StatID } from '../../utils/statsCalculator';
import { getDisplayProcessor } from '../../utils/displayValue';
import { getFlotPairs } from '../../utils/flotPairs';
export { FieldDisplayEditor } from './FieldDisplayEditor';

export interface SingleStatBaseOptions {
  valueMappings: ValueMapping[];
  thresholds: Threshold[];
  valueOptions: FieldDisplayOptions;
  orientation: VizOrientation;
}

export interface FieldDisplayOptions {
  title?: string; // empty is 'auto', otherwise template

  showAllValues: boolean; // If true show each row value
  stats: string[]; // when !values, pick one value for the whole field

  defaults: Partial<Field>; // Use these values unless otherwise stated
  override: Partial<Field>; // Set these values regardless of the source
}

export interface GetFieldDisplayValueOptions {
  data?: SeriesData[];
  theme: GrafanaTheme;
  valueMappings: ValueMapping[];
  thresholds: Threshold[];
  valueOptions: FieldDisplayOptions;
  replaceVariables: InterpolateFunction;
  sparkline?: boolean;
}

const VAR_SERIES_NAME = '__series_name';
const VAR_FIELD_NAME = '__field_name';
const VAR_STAT = '__stat';

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
    parts.push('$' + VAR_STAT);
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

export const getFieldDisplayValues = (options: GetFieldDisplayValueOptions): FieldDisplay[] => {
  const { data, replaceVariables, valueOptions, sparkline } = options;
  const { defaults, override, showAllValues } = valueOptions;
  const stats = valueOptions.stats.length ? valueOptions.stats : [StatID.last];

  const values: FieldDisplay[] = [];

  if (data) {
    const title = getTitleTemplate(valueOptions.title, stats, data);
    const scopedVars: ScopedVars = {};

    for (let s = 0; s < data.length; s++) {
      const series = data[s];
      scopedVars[VAR_SERIES_NAME] = { text: 'Series', value: series.name ? series.name : `Series[${s}]` };

      let timeColumn = -1;
      if (sparkline) {
        for (let i = 0; i < series.fields.length; i++) {
          if (series.fields[i].type === FieldType.time) {
            timeColumn = i;
            break;
          }
        }
      }

      for (let i = 0; i < series.fields.length; i++) {
        // Maybe use a different method that checks isNaN? and 'none'
        const field: Field = {
          ...defaults,
          ...series.fields[i],
          ...override,
        };

        // Show all number fields
        if (field.type !== FieldType.number) {
          continue;
        }

        scopedVars[VAR_FIELD_NAME] = { text: 'Field', value: field.name ? field.name : `Field[${s}]` };

        const display = getDisplayProcessor({
          ...field,
          mappings: options.valueMappings,
          thresholds: options.thresholds,
          prefix: field.prefix ? replaceVariables(field.prefix) : undefined,
          suffix: field.suffix ? replaceVariables(field.suffix) : undefined,
          theme: options.theme,
        });

        // Show all number fields
        if (showAllValues) {
          for (const row of series.rows) {
            // Add all the row variables
            for (let j = 0; j < series.fields.length; j++) {
              scopedVars[`__cell_${j}`] = { value: row[i], text: `Cell: ${j}` };
            }

            const displayValue = display(row[i]);
            displayValue.title = replaceVariables(title, scopedVars);
            values.push({
              field,
              display: displayValue,
            });
          }
        } else {
          const results = calculateStats({
            series,
            fieldIndex: i,
            stats, // The stats to calculate
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

          for (const stat of stats) {
            scopedVars[VAR_STAT] = { value: stat, text: stat };
            const displayValue = display(results[stat]);
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
  } else if (values.length === 1) {
    // Don't show title for single item
    values[0].display.title = undefined;
  }

  return values;
};

const optionsToKeep = ['valueOptions', 'stat', 'maxValue', 'maxValue', 'thresholds', 'valueMappings'];

export const sharedSingleStatOptionsCheck = (
  options: Partial<SingleStatBaseOptions> | any,
  prevPluginId: string,
  prevOptions: any
) => {
  for (const k of optionsToKeep) {
    if (prevOptions.hasOwnProperty(k)) {
      options[k] = cloneDeep(prevOptions[k]);
    }
  }
  return options;
};

export const sharedSingleStatMigrationCheck = (panel: PanelModel<SingleStatBaseOptions>) => {
  const options = panel.options;

  if (!options) {
    // This happens on the first load or when migrating from angular
    return {};
  }

  if (options.valueOptions) {
    // 6.1 renamed some stats, This makes sure they are up to date
    // avg -> mean, current -> last, total -> sum
    const { valueOptions } = options;
    if (valueOptions) {
      // 6.2 renamed 'stat' to 'stats'
      const opts = valueOptions as any;
      if (opts.stat) {
        valueOptions.stats = [opts.stat];
        delete opts.stat;
      }
      if (valueOptions.stats) {
        valueOptions.stats = getStatsCalculators(valueOptions.stats).map(s => s.id);
      }
    }
  }
  return options;
};
