import { Field, FieldType, PanelPlugin } from '@grafana/data';
import { commonOptionsBuilder } from '@grafana/ui';

import { defaultGraphConfig, getGraphFieldConfig } from '../timeseries/config';

import { TrendPanel } from './TrendPanel';
import { FieldConfig, Options } from './panelcfg.gen';
import { TrendSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin<Options, FieldConfig>(TrendPanel)
  .useFieldConfig(getGraphFieldConfig(defaultGraphConfig, false))
  .setPanelOptions((builder) => {
    const category = ['X axis'];
    builder.addFieldNamePicker({
      path: 'xField',
      name: 'X field',
      description: 'An increasing numeric value',
      category,
      defaultValue: undefined,
      settings: {
        isClearable: true,
        placeholderText: 'First numeric value',
        filter: (field: Field) => field.type === FieldType.number,
      },
    });

    commonOptionsBuilder.addTooltipOptions(builder, false, true);
    commonOptionsBuilder.addLegendOptions(builder);
  })
  .setSuggestionsSupplier(new TrendSuggestionsSupplier());
//.setDataSupport({ annotations: true, alertStates: true });
