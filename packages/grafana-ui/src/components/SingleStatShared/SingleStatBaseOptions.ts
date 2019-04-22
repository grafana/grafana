import cloneDeep from 'lodash/cloneDeep';

import { VizOrientation, PanelModel } from '../../types/panel';
import { FieldDisplayOptions } from '../../utils/fieldDisplay';
import { getStatsCalculators } from '../../utils/index';

export interface SingleStatBaseOptions {
  fieldOptions: FieldDisplayOptions;
  orientation: VizOrientation;
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

  const old = options as any;
  if (old.valueOptions) {
    const { valueOptions } = old;
    if (valueOptions) {
      const opts = valueOptions as any;
      if (opts.stat) {
        // 6.2 moved 'stat' to 'stats[]'
        valueOptions.stats = [opts.stat];
        delete opts.stat;
      }
      // 6.1 renamed some stats, This makes sure they are up to date
      // avg -> mean, current -> last, total -> sum
      if (valueOptions.stats) {
        valueOptions.stats = getStatsCalculators(valueOptions.stats).map(s => s.id);
      }
    }

    // TODO: make this real!
    options.fieldOptions = valueOptions;
  }
  return options;
};
