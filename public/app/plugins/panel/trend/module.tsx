import { Field, FieldType, PanelPlugin } from '@grafana/data';
import { SortOrder } from '@grafana/schema/dist/esm/common/common.gen';
import { commonOptionsBuilder, TooltipDisplayMode } from '@grafana/ui';

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

    commonOptionsBuilder.addTooltipOptions(builder, false, true, {
      tooltip: { mode: TooltipDisplayMode.Single, sort: SortOrder.None, hideZeros: false },
    });
    commonOptionsBuilder.addLegendOptions(builder);
  })
  .setSuggestionsSupplier(new TrendSuggestionsSupplier());
//.setDataSupport({ annotations: true, alertStates: true });
