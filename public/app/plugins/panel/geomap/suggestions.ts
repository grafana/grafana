import { VisualizationSuggestionScore, VisualizationSuggestionsSupplier } from '@grafana/data';
import { GraphFieldConfig } from '@grafana/ui';
import { getGeometryField, getDefaultLocationMatchers } from 'app/features/geo/utils/location';

import { Options } from './panelcfg.gen';

export const geomapSuggestionsSupplier: VisualizationSuggestionsSupplier<Options, GraphFieldConfig> = (dataSummary) => {
  if (!dataSummary.hasData || !dataSummary.rawFrames) {
    return;
  }

  // use getGeometryField to see if any frames have geolocation info
  const location = getDefaultLocationMatchers();
  if (!dataSummary.rawFrames.some((frame) => !getGeometryField(frame, location).warning)) {
    return;
  }

  return [
    {
      score: VisualizationSuggestionScore.Best,
      fieldConfig: {
        defaults: {
          custom: {},
        },
        overrides: [],
      },
      cardOptions: {
        previewModifier: (s) => {
          s.options!.controls = {
            showZoom: false,
            showScale: false,
            showAttribution: false,
            showMeasure: false,
          };
          // FIXME: this doesn't work. I want to disable legends in the preview.
          s.options?.layers?.forEach((layer) => {
            layer.config = layer.config || {};
            layer.config.showLegend = false;
          });
        },
      },
    },
  ];
};
