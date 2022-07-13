import { FieldColorModeId, FieldConfigProperty, PanelPlugin, SetFieldConfigOptionsArgs } from '@grafana/data';
import { GraphFieldConfig } from '@grafana/schema';

import { VideoPanel } from './VideoPanel';
import { PanelOptions, defaultPanelOptions, defaultPanelFieldConfig, PanelFieldConfig } from './models.gen';

export const plugin = new PanelPlugin<PanelOptions, GraphFieldConfig>(VideoPanel)
  .useFieldConfig(getVideoFieldConfig(defaultPanelFieldConfig))
  .setPanelOptions((builder, context) => {
    const opts = context.options ?? defaultPanelOptions;
    // TODO
    console.log('OPTS', opts);
  });

function getVideoFieldConfig(cfg: PanelFieldConfig): SetFieldConfigOptionsArgs<PanelFieldConfig> {
  return {
    standardOptions: {
      [FieldConfigProperty.Color]: {
        settings: {
          byValueSupport: true,
          bySeriesSupport: true,
          preferThresholdsMode: false,
        },
        defaultValue: {
          mode: FieldColorModeId.PaletteClassic,
        },
      },
    },

    useCustomConfig: (builder) => {},
  };
}
