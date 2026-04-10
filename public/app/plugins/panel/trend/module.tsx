import { type Field, FieldType, PanelPlugin, VisualizationSuggestionScore } from '@grafana/data';
import { t } from '@grafana/i18n';
import { GraphDrawStyle } from '@grafana/schema';
import { commonOptionsBuilder } from '@grafana/ui';
import { optsWithHideZeros } from '@grafana/ui/internal';
import { SUGGESTIONS_LEGEND_OPTIONS } from 'app/features/panel/suggestions/utils';

import { defaultGraphConfig, getGraphFieldConfig } from '../timeseries/config';

import { TrendPanel } from './TrendPanel';
import { type FieldConfig, type Options } from './panelcfg.gen';
import { prepSeries } from './utils';

export const plugin = new PanelPlugin<Options, FieldConfig>(TrendPanel)
  .useFieldConfig(getGraphFieldConfig(defaultGraphConfig, false))
  .setPanelOptions((builder) => {
    const category = [t('trend.category-x-axis', 'X axis')];
    builder.addFieldNamePicker({
      path: 'xField',
      name: t('trend.name-x-field', 'X field'),
      description: t('trend.description-x-field', 'A numeric or categorical field for the X axis'),
      category,
      defaultValue: undefined,
      settings: {
        isClearable: true,
        placeholderText: t('trend.placeholder-x-field', 'First numeric or string field'),
        filter: (field: Field) => field.type === FieldType.number || field.type === FieldType.string,
      },
    });

    commonOptionsBuilder.addTooltipOptions(builder, false, true, optsWithHideZeros);
    commonOptionsBuilder.addLegendOptions(builder, true, true);
  })
  .setSuggestionsSupplier((ds) => {
    const hasStringX = ds.fieldCountByType(FieldType.string) > 0;
    const minNumbers = hasStringX ? 1 : 2; // string X needs 1 number for Y; numeric X needs 2
    if (
      !ds.rawFrames ||
      ds.fieldCountByType(FieldType.number) < minNumbers ||
      ds.rowCountTotal < 2 ||
      ds.frameCount > 1
    ) {
      return;
    }

    const info = prepSeries(ds.rawFrames);
    if (info.warning || !info.frames) {
      return;
    }

    const isStringX = hasStringX && ds.fieldCountByType(FieldType.time) === 0;
    return [
      {
        // Categorical data is more naturally a bar chart; rank below Bar Chart's default (OK=50)
        score: isStringX ? VisualizationSuggestionScore.OK - 10 : VisualizationSuggestionScore.Good,
        fieldConfig: {
          defaults: {
            custom: {},
          },
          overrides: [],
        },
        cardOptions: {
          previewModifier: (s) => {
            s.options!.legend = SUGGESTIONS_LEGEND_OPTIONS;
            if (s.fieldConfig?.defaults.custom?.drawStyle !== GraphDrawStyle.Bars) {
              s.fieldConfig!.defaults.custom!.lineWidth = Math.max(s.fieldConfig!.defaults.custom!.lineWidth ?? 1, 2);
            }
          },
        },
      },
    ];
  });
//.setDataSupport({ annotations: true, alertStates: true });
