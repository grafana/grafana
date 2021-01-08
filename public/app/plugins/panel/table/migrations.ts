import { PanelModel } from '@grafana/data';
import { ReduceTransformerOptions } from '@grafana/data/src/transformations/transformers/reduce';
import { Options } from './types';

/**
 * At 7.0, the `table` panel was swapped from an angular implementation to a react one.
 * The models do not match, so this process will delegate to the old implementation when
 * a saved table configuration exists.
 */
export const tableMigrationHandler = (panel: PanelModel<Options>): Partial<Options> => {
  // Table was saved as an angular table, lets just swap to the 'table-old' panel
  if (!panel.pluginVersion && (panel as any).columns) {
    console.log('Was angular table', panel);
  }

  // Nothing changed
  return panel.options;
};

const transformsMap = {
  timeseries_to_rows: 'seriesToRows',
  timeseries_to_columns: 'seriesToColumns',
  timeseries_aggregations: 'reduce',
};

const columnsMap = {
  avg: 'mean',
  min: 'min',
  max: 'max',
  total: 'sum',
  current: 'last',
  count: 'count',
};

const migrateTransformations = (panel: PanelModel<Partial<Options>> | any, oldOpts: any) => {
  const transformations = panel.transformations ?? [];
  if (Object.keys(transformsMap).includes(oldOpts.transform)) {
    const opts: ReduceTransformerOptions = {
      reducers: [],
    };
    if (oldOpts.transform === 'timeseries_aggregations') {
      opts.includeTimeField = false;
      opts.reducers = oldOpts.columns.map((column: any) => columnsMap[column.value]);
    }
    transformations.push({
      id: transformsMap[oldOpts.transform],
      options: opts,
    });
  }
  return transformations;
};

/**
 * This is called when the panel changes from another panel
 */
export const tablePanelChangedHandler = (
  panel: PanelModel<Partial<Options>> | any,
  prevPluginId: string,
  prevOptions: any
) => {
  // Changing from angular table panel
  if (prevPluginId === 'table-old' && prevOptions.angular) {
    const oldOpts = prevOptions.angular;
    const transformations = migrateTransformations(panel, oldOpts);

    panel.transformations = transformations;
  }

  return {};
};
