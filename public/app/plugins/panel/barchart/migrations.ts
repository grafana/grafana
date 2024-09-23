import { FieldMatcherID, PanelTypeChangedHandler } from '@grafana/data';
import { AxisPlacement } from '@grafana/ui';

/*
 * This is called when the panel changes from another panel
 */
export const changeToBarChartPanelMigrationHandler: PanelTypeChangedHandler = (panel, prevPluginId, prevOptions) => {
  if (prevPluginId === 'graph') {
    const graphOptions: GraphOptions = prevOptions.angular;

    const fieldConfig = panel.fieldConfig ?? { defaults: {}, overrides: [] };

    if (graphOptions.xaxis?.mode === 'series') {
      const transformations = panel.transformations || [];
      transformations.push(
        {
          id: 'reduce',
          options: {
            reducers: graphOptions.xaxis?.values ?? ['sum'],
          },
        },
        {
          id: 'transpose',
          options: {},
        }
      );

      panel.transformations = transformations;

      // temporary, until we have a bar chart with per bar labels
      fieldConfig.overrides.push({
        matcher: {
          id: FieldMatcherID.byName,
          options: 'Field',
        },
        properties: [
          {
            id: 'custom.axisPlacement',
            value: AxisPlacement.Hidden,
          },
        ],
      });

      panel.fieldConfig = fieldConfig;
      panel.options = {
        ...panel.options,
        groupWidth: 1,
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
