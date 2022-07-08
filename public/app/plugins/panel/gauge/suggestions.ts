import { ThresholdsMode, VisualizationSuggestionsBuilder } from '@grafana/data';
import { SuggestionName } from 'app/types/suggestions';

import { PanelOptions } from './models.gen';

export class GaugeSuggestionsSupplier {
  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    const { dataSummary } = builder;

    if (!dataSummary.hasData || !dataSummary.hasNumberField) {
      return;
    }

    // for many fields / series this is probably not a good fit
    if (dataSummary.numberFieldCount >= 50) {
      return;
    }

    const list = builder.getListAppender<PanelOptions, {}>({
      name: SuggestionName.Gauge,
      pluginId: 'gauge',
      options: {},
      fieldConfig: {
        defaults: {
          thresholds: {
            steps: [
              { value: -Infinity, color: 'green' },
              { value: 70, color: 'orange' },
              { value: 85, color: 'red' },
            ],
            mode: ThresholdsMode.Percentage,
          },
          custom: {},
        },
        overrides: [],
      },
      cardOptions: {
        previewModifier: (s) => {
          if (s.options!.reduceOptions.values) {
            s.options!.reduceOptions.limit = 2;
          }
        },
      },
    });

    if (dataSummary.hasStringField && dataSummary.frameCount === 1 && dataSummary.rowCountTotal < 10) {
      list.append({
        name: SuggestionName.Gauge,
        options: {
          reduceOptions: {
            values: true,
            calcs: [],
          },
        },
      });
      list.append({
        name: SuggestionName.GaugeNoThresholds,
        options: {
          reduceOptions: {
            values: true,
            calcs: [],
          },
          showThresholdMarkers: false,
        },
      });
    } else {
      list.append({
        name: SuggestionName.Gauge,
        options: {
          reduceOptions: {
            values: false,
            calcs: ['lastNotNull'],
          },
        },
      });
      list.append({
        name: SuggestionName.GaugeNoThresholds,
        options: {
          reduceOptions: {
            values: false,
            calcs: ['lastNotNull'],
          },
          showThresholdMarkers: false,
        },
      });
    }
  }
}
