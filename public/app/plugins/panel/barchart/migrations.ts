import { PanelTypeChangedHandler } from '@grafana/data';

/*
 * This is called when the panel changes from another panel
 */
export const changeToBarChartPanelMigrationHandler: PanelTypeChangedHandler = (
  panel,
  prevPluginId,
  prevOptions,
  prevFieldConfig
) => {
  if (prevPluginId === 'graph') {
    const graphOptions: GraphOptions = prevOptions.angular;

    if (graphOptions.xaxis?.mode === 'series') {
      const tranformations = panel.transformations || [];
      tranformations.push({
        id: 'reduce',
        options: {
          reducers: graphOptions.xaxis?.values ?? ['sum'],
        },
      });

      panel.transformations = tranformations;
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
