import { FieldColorModeId, FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { CandlestickPanel } from './CandlestickPanel';
import { commonOptionsBuilder } from '@grafana/ui';
import { PanelOptions, PanelFieldConfig } from './models.gen';

export const plugin = new PanelPlugin<PanelOptions, PanelFieldConfig>(CandlestickPanel)
  .setPanelOptions((builder) => {
    // nothing yet
  })
  .useFieldConfig({
    standardOptions: {
      [FieldConfigProperty.Color]: {
        settings: {
          byValueSupport: false,
        },
        defaultValue: {
          mode: FieldColorModeId.PaletteClassic,
        },
      },
    },
    useCustomConfig: (builder) => {
      commonOptionsBuilder.addHideFrom(builder);
    },
  });
