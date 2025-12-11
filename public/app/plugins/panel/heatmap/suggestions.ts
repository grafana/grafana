import {
  DataFrameType,
  FieldType,
  PanelDataSummary,
  VisualizationSuggestionScore,
  VisualizationSuggestionsSupplier,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { GraphFieldConfig } from '@grafana/schema';

import { prepareHeatmapData } from './fields';
import { quantizeScheme } from './palettes';
import { Options, defaultOptions } from './types';

function determineScore(dataSummary: PanelDataSummary): VisualizationSuggestionScore {
  // look to see if the data has an explicity marker for heatmap data on it.
  if ([DataFrameType.HeatmapRows, DataFrameType.HeatmapCells].some((t) => dataSummary.hasDataFrameType(t))) {
    return VisualizationSuggestionScore.Best;
  }

  // we'll also look more closely at frames which return between 3 and 10 numeric fields.
  if (dataSummary.fieldCountByType(FieldType.number) > 2 || dataSummary.fieldCountByType(FieldType.number) <= 10) {
    // look through the names of the panels
    const hasPotentialHeatmapSeries = dataSummary.rawFrames!.some((frame) => {
      for (const field of frame.fields) {
        if (field.type === FieldType.number) {
          // if the field name, or "ge" or "le" label on the field, are numeric, then it's very possibly part of a heatmap.
          if ([field.name, field.labels?.ge, field.labels?.le].some((v) => !isNaN(Number(v)))) {
            return true;
          }
        }
      }
      return false;
    });

    // if at least all but 1 of the numeric fields in the frame have numeric names, then this is probably a heatmap.
    // (the out-of-place one would be "Inf" or "-Inf")
    if (hasPotentialHeatmapSeries) {
      return VisualizationSuggestionScore.Best;
    }
  }

  return VisualizationSuggestionScore.OK;
}

export const heatmapSuggestionsSupplier: VisualizationSuggestionsSupplier<Options, GraphFieldConfig> = (
  dataSummary: PanelDataSummary
) => {
  if (
    !dataSummary.rawFrames ||
    !dataSummary.hasData ||
    !dataSummary.hasFieldType(FieldType.time) ||
    !dataSummary.hasFieldType(FieldType.number)
  ) {
    return;
  }

  // parse the frame into a heatmap structure to see if it's possible.
  const palette = quantizeScheme(defaultOptions.color, config.theme2);
  const info = prepareHeatmapData({
    frames: dataSummary.rawFrames,
    options: defaultOptions,
    palette,
    theme: config.theme2,
  });

  // if we can't parse the data into a heatmap, then bail out and prevent showing suggestions.
  if (!info || info.warning) {
    return;
  }

  return [{ score: determineScore(dataSummary) }];
};
