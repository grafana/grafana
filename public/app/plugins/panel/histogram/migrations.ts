import { PanelTypeChangedHandler } from '@grafana/data';

/*
 * This is called when the panel changes from another panel
 */
export const changeToHistogramPanelMigrationHandler: PanelTypeChangedHandler = (
  panel,
  prevPluginId,
  prevOptions,
  prevFieldConfig
) => {
  if (prevPluginId === 'graph') {
    const graphOptions: GraphOptions = prevOptions.angular;

    if (graphOptions.xaxis?.mode === 'histogram') {
      return {
        combine: true,
      };
    }
  }

  return {};
};

interface GraphOptions {
  xaxis: {
    mode: 'series' | 'time' | 'histogram';
    values?: string[];
  };
}
