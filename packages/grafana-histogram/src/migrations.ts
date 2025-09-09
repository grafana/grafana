import { isNil, omitBy } from 'lodash';

import { FieldConfigSource, PanelTypeChangedHandler } from '@grafana/data';
import { LegendDisplayMode, SortOrder, StackingMode, TooltipDisplayMode } from '@grafana/schema';

import { defaultHistogramConfig } from './config';
import { FieldConfig as HistogramFieldConfig, Options } from './panelcfg.gen';

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
      const { fieldConfig, options } = graphToHistogramOptions({
        ...prevOptions.angular,
        fieldConfig: prevFieldConfig,
      });

      panel.fieldConfig = fieldConfig; // Mutates the incoming panel

      return options;
    }
  }

  return {};
};

function graphToHistogramOptions(graphOptions: GraphOptions): {
  fieldConfig: FieldConfigSource;
  options: Options;
} {
  let histogramFieldConfig: HistogramFieldConfig = {};
  const options: Options = {
    legend: {
      displayMode: LegendDisplayMode.List,
      showLegend: true,
      placement: 'bottom',
      calcs: [],
    },
    tooltip: {
      mode: TooltipDisplayMode.Single,
      sort: SortOrder.None,
    },
    combine: false,
  };

  if (graphOptions.stack) {
    histogramFieldConfig.stacking = {
      mode: graphOptions.percentage ? StackingMode.Percent : StackingMode.Normal,
      group: defaultHistogramConfig.stacking!.group,
    };

    options.combine = false;
  }

  return {
    fieldConfig: {
      defaults: omitBy(
        {
          custom: histogramFieldConfig,
        },
        isNil
      ),
      overrides: [],
    },
    options,
  };
}

interface GraphOptions {
  stack?: boolean;
  percentage?: boolean;
  xaxis: {
    mode: 'series' | 'time' | 'histogram';
    values?: string[];
  };
}
