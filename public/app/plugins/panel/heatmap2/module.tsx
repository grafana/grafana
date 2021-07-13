import { FieldColorModeId, FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { HeatmapPanel } from './HeatmapPanel';
import { commonOptionsBuilder, graphFieldOptions } from '@grafana/ui';
import { PanelFieldConfig, PanelOptions, defaultPanelFieldConfig, defaultPanelOptions } from './models.gen';
import { originalDataHasHistogram } from './utils';

import { histogramFieldInfo } from '@grafana/data/src/transformations/transformers/histogram';

export const plugin = new PanelPlugin<PanelOptions, PanelFieldConfig>(HeatmapPanel)
  .setPanelOptions((builder) => {
    builder
      .addCustomEditor({
        id: '__calc__',
        path: '__calc__',
        name: 'Values',
        description: 'Showing frequencies that are calculated in the query',
        editor: () => null, // empty editor
        showIf: (opts, data) => originalDataHasHistogram(data),
      })
      .addNumberInput({
        path: 'bucketSize',
        name: histogramFieldInfo.bucketSize.name,
        description: histogramFieldInfo.bucketSize.description,
        settings: {
          placeholder: 'Auto',
        },
        defaultValue: defaultPanelOptions.bucketSize,
        showIf: (opts, data) => !originalDataHasHistogram(data),
      })
      .addNumberInput({
        path: 'bucketOffset',
        name: histogramFieldInfo.bucketOffset.name,
        description: histogramFieldInfo.bucketOffset.description,
        settings: {
          placeholder: '0',
        },
        defaultValue: defaultPanelOptions.bucketOffset,
        showIf: (opts, data) => !originalDataHasHistogram(data),
      })
      .addBooleanSwitch({
        path: 'combine',
        name: histogramFieldInfo.combine.name,
        description: histogramFieldInfo.combine.description,
        defaultValue: defaultPanelOptions.combine,
        showIf: (opts, data) => !originalDataHasHistogram(data),
      });

    // commonOptionsBuilder.addTooltipOptions(builder);
    commonOptionsBuilder.addLegendOptions(builder);
  })
  .useFieldConfig({
    standardOptions: {
      [FieldConfigProperty.Color]: {
        settings: {
          byValueSupport: true,
        },
        defaultValue: {
          mode: FieldColorModeId.ContinuousGrYlRd,
        },
      },
    },
  });
