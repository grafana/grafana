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
} from '../../types';
import { getStatsCalculators, calculateStats } from '../../utils/statsCalculator';
import { getDisplayProcessor } from '../../utils/displayValue';
export { SingleStatValueEditor } from './SingleStatValueEditor';

export interface SingleStatBaseOptions {
  valueMappings: ValueMapping[];
  thresholds: Threshold[];
  valueOptions: SingleStatValueOptions;
  orientation: VizOrientation;
}

export interface SingleStatValueOptions {
  unit: string;
  suffix: string;
  stat: string;
  prefix: string;
  decimals?: number | null;
}

export interface GetSingleStatDisplayValueOptions {
  data: SeriesData[];
  theme: GrafanaTheme;
  valueMappings: ValueMapping[];
  thresholds: Threshold[];
  valueOptions: SingleStatValueOptions;
  replaceVariables: InterpolateFunction;
}

export const getSingleStatDisplayValues = (options: GetSingleStatDisplayValueOptions): DisplayValue[] => {
  const { data, replaceVariables, valueOptions } = options;
  const { unit, decimals, stat } = valueOptions;

  const display = getDisplayProcessor({
    unit,
    decimals,
    mappings: options.valueMappings,
    thresholds: options.thresholds,
    prefix: replaceVariables(valueOptions.prefix),
    suffix: replaceVariables(valueOptions.suffix),
    theme: options.theme,
  });

  const values: DisplayValue[] = [];

  for (const series of data) {
    if (stat === 'name') {
      values.push(display(series.name));
    }

    for (let i = 0; i < series.fields.length; i++) {
      const column = series.fields[i];

      // Show all fields that are not 'time'
      if (column.type === FieldType.number) {
        const stats = calculateStats({
          series,
          fieldIndex: i,
          stats: [stat], // The stats to calculate
          nullValueMode: NullValueMode.Null,
        });
        const displayValue = display(stats[stat]);
        values.push(displayValue);
      }
    }
  }

  if (values.length === 0) {
    values.push({
      numeric: 0,
      text: 'No data',
    });
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
    if (valueOptions && valueOptions.stat) {
      valueOptions.stat = getStatsCalculators([valueOptions.stat]).map(s => s.id)[0];
    }
  }
  return options;
};
