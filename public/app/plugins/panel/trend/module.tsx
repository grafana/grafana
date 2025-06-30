import { Field, FieldType, PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';
import { commonOptionsBuilder } from '@grafana/ui';
import { optsWithHideZeros } from '@grafana/ui/internal';

import { defaultGraphConfig, getGraphFieldConfig } from '../timeseries/config';

import { TrendPanel } from './TrendPanel';
import { FieldConfig, Options } from './panelcfg.gen';
import { TrendSuggestionsSupplier } from './suggestions';

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
  .setSuggestionsSupplier(new TrendSuggestionsSupplier());
//.setDataSupport({ annotations: true, alertStates: true });
