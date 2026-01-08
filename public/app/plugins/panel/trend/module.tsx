import { Field, FieldType, PanelPlugin, VisualizationSuggestionScore } from '@grafana/data';
import { t } from '@grafana/i18n';
import { GraphDrawStyle } from '@grafana/schema';
import { commonOptionsBuilder, LegendDisplayMode } from '@grafana/ui';
import { optsWithHideZeros } from '@grafana/ui/internal';

import { defaultGraphConfig, getGraphFieldConfig } from '../timeseries/config';

import { TrendPanel } from './TrendPanel';
import { FieldConfig, Options } from './panelcfg.gen';
import { prepSeries } from './utils';

export const plugin = new PanelPlugin<Options, FieldConfig>(TrendPanel)
  .useFieldConfig(getGraphFieldConfig(defaultGraphConfig, false))
  .setPanelOptions((builder) => {
    const category = [t('trend.category-x-axis', 'X axis')];
    builder.addFieldNamePicker({
      path: 'xField',
      name: t('trend.name-x-field', 'X field'),
      description: t('trend.description-x-field', 'An increasing numeric value'),
      category,
      defaultValue: undefined,
      settings: {
        isClearable: true,
        placeholderText: t('trend.placeholder-x-field', 'First numeric value'),
        filter: (field: Field) => field.type === FieldType.number,
      },
    });

    commonOptionsBuilder.addTooltipOptions(builder, false, true, optsWithHideZeros);
    commonOptionsBuilder.addLegendOptions(builder);
  })
  .setSuggestionsSupplier((ds) => {
    if (
      !ds.rawFrames ||
      ds.fieldCountByType(FieldType.number) < 2 ||
      ds.rowCountTotal < 2 ||
      ds.rowCountTotal < 2 ||
      ds.frameCount > 1
    ) {
      return;
    }

    const info = prepSeries(ds.rawFrames);
    if (info.warning || !info.frames) {
      return;
    }

    return [
      {
        score: VisualizationSuggestionScore.Good,
        options: {
          legend: {
            calcs: [],
            displayMode: LegendDisplayMode.Hidden,
            placement: 'right',
            showLegend: false,
          },
        },
        fieldConfig: {
          defaults: {
            custom: {},
          },
          overrides: [],
        },
        cardOptions: {
          previewModifier: (s) => {
            if (s.fieldConfig?.defaults.custom?.drawStyle !== GraphDrawStyle.Bars) {
              s.fieldConfig!.defaults.custom!.lineWidth = Math.max(s.fieldConfig!.defaults.custom!.lineWidth ?? 1, 2);
            }
          },
        },
      },
    ];
  });
//.setDataSupport({ annotations: true, alertStates: true });
