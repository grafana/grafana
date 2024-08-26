import { PanelTypeChangedHandler } from '@grafana/data';

/*
 * This is called when the panel changes from another panel
 */
export const changeToBarGaugePanelMigrationHandler: PanelTypeChangedHandler = (
  panel,
  prevPluginId,
  prevOptions,
  prevFieldConfig
) => {
  if (prevPluginId === 'graph') {
    const graphOptions: GraphOptions = prevOptions.angular;

    if (graphOptions.xaxis?.mode === 'series') {
      panel.fieldConfig.defaults.color = { mode: 'palette-classic' };
      // migrate legend
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
