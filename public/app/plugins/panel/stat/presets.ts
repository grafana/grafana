import { FieldColorModeId, ThresholdsMode, VisualizationPresetsSupplier, VizOrientation } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  BigValueColorMode,
  BigValueGraphMode,
  BigValueJustifyMode,
  BigValueTextMode,
  GraphFieldConfig,
  PercentChangeColorMode,
} from '@grafana/schema';

import { Options } from './panelcfg.gen';

export const statPresetsSupplier: VisualizationPresetsSupplier<Options, GraphFieldConfig> = ({ dataSummary }) => {
  const isSingleSeries = (dataSummary?.frameCount ?? 0) === 1;

  if (isSingleSeries) {
    return [
      {
        name: t('stat.presets.threshold-value', 'Threshold value'),
        description: t('stat.presets.threshold-value-description', 'Color from thresholds, no graph'),
        options: {
          orientation: VizOrientation.Auto,
          textMode: BigValueTextMode.Auto,
          wideLayout: true,
          colorMode: BigValueColorMode.Value,
          graphMode: BigValueGraphMode.None,
          justifyMode: BigValueJustifyMode.Auto,
          showPercentChange: false,
          percentChangeColorMode: PercentChangeColorMode.Standard,
        },
        fieldConfig: {
          defaults: {
            thresholds: {
              mode: ThresholdsMode.Percentage,
              steps: [
                // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                { value: null as unknown as number, color: 'green' },
                { value: 80, color: 'red' },
              ],
            },
            color: {
              mode: FieldColorModeId.Thresholds,
              fixedColor: '#ad46ff',
            },
          },
          overrides: [],
        },
      },
    ];
  }

  return [];
};
