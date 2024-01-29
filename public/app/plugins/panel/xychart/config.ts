import { FieldColorModeId, FieldConfigProperty, SetFieldConfigOptionsArgs } from '@grafana/data';
import { commonOptionsBuilder } from '@grafana/ui';

import { FieldConfig } from './panelcfg.gen';

export const DEFAULT_POINT_SIZE = 5;

export function getScatterFieldConfig(cfg: FieldConfig): SetFieldConfigOptionsArgs<FieldConfig> {
  return {
    standardOptions: {
      [FieldConfigProperty.Min]: {
        hideFromDefaults: true,
      },
      [FieldConfigProperty.Max]: {
        hideFromDefaults: true,
      },
      [FieldConfigProperty.Unit]: {
        hideFromDefaults: true,
      },
      [FieldConfigProperty.Decimals]: {
        hideFromDefaults: true,
      },
      [FieldConfigProperty.NoValue]: {
        hideFromDefaults: true,
      },
      [FieldConfigProperty.DisplayName]: {
        hideFromDefaults: true,
      },

      [FieldConfigProperty.Thresholds]: {
        hideFromDefaults: true,
      },
      [FieldConfigProperty.Mappings]: {
        hideFromDefaults: true,
      },

      // TODO: this still leaves Color series by: [ Last | Min | Max ]
      // because item.settings?.bySeriesSupport && colorMode.isByValue
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

    useCustomConfig: (builder) => {
      commonOptionsBuilder.addAxisConfig(builder, cfg);
      commonOptionsBuilder.addHideFrom(builder);
    },
  };
}
