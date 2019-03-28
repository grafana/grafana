import cloneDeep from 'lodash/cloneDeep';
import { ValueMapping, Threshold, VizOrientation, PanelModel } from '../../types';
import { getStatsCalculators } from '../../utils/statsCalculator';

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
