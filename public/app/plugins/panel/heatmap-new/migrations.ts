import { FieldConfigSource, PanelModel, PanelTypeChangedHandler } from '@grafana/data';
import { LegendDisplayMode, SortOrder, TooltipDisplayMode } from '@grafana/schema';
import { HeatmapSourceMode, PanelOptions, defaultPanelOptions } from './models.gen';

/**
 * This is called when the panel changes from another panel
 */
export const heatmapChangedHandler: PanelTypeChangedHandler = (panel, prevPluginId, prevOptions, prevFieldConfig) => {
  if (prevPluginId === 'heatmap' && prevOptions.angular) {
    const { fieldConfig, options } = angularToReactHeatmap({
      ...prevOptions.angular,
      fieldConfig: prevFieldConfig,
    });
    panel.fieldConfig = fieldConfig; // Mutates the incoming panel
    return options;
  }
  return {};
};

export function angularToReactHeatmap(angular: any): { fieldConfig: FieldConfigSource; options: PanelOptions } {
  const fieldConfig: FieldConfigSource = {
    defaults: {},
    overrides: [],
  };

  const options: PanelOptions = {
    source: HeatmapSourceMode.Auto,
    color: defaultPanelOptions.color,
    cellPadding: asNumber(angular.cards?.cardPadding),
    cellRadius: asNumber(angular.cards?.cardRound),
    legend: {
      displayMode: angular.legend.show ? LegendDisplayMode.List : LegendDisplayMode.Hidden,
      calcs: [],
      placement: 'bottom',
    },
    tooltip: {
      mode: TooltipDisplayMode.Multi,
      sort: SortOrder.None,
    },
  };

  return { fieldConfig, options };
}

function asNumber(v: any): number | undefined {
  const num = +v;
  return isNaN(num) ? undefined : num;
}

export const heatmapMigrationHandler = (panel: PanelModel): Partial<PanelOptions> => {
  // Nothing yet
  return panel.options;
};
