import { FieldMatcherID, PanelTypeChangedHandler, ReducerID } from '@grafana/data';
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
            reducers: getReducer(graphOptions.xaxis?.values),
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

// same as grafana-ui/src/components/SingleStatShared/SingleStatBaseOptions.ts
const getReducer = (reducers: string[] | undefined) => {
  const transformReducers: string[] = [];

  reducers?.forEach((reducer) => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    if (!Object.values(ReducerID).includes(reducer as ReducerID)) {
      if (reducer === 'current') {
        transformReducers.push(ReducerID.lastNotNull);
      } else if (reducer === 'total') {
        transformReducers.push(ReducerID.sum);
      } else if (reducer === 'avg') {
        transformReducers.push(ReducerID.mean);
      }
    } else {
      transformReducers.push(reducer);
    }
  });

  return reducers ? transformReducers : [ReducerID.sum];
};

interface GraphOptions {
  xaxis: {
    mode: 'series' | 'time' | 'histogram';
    values?: string[];
  };
}
