import { FieldType, PanelPlugin } from '@grafana/data';
import { commonOptionsBuilder } from '@grafana/ui';
import { defaultGraphConfig, getGraphFieldConfig } from '../timeseries/config';
import { TrendPanel } from './TrendPanel';
import { TrendSuggestionsSupplier } from './suggestions';
export const plugin = new PanelPlugin(TrendPanel)
    .useFieldConfig(getGraphFieldConfig(defaultGraphConfig, false))
    .setPanelOptions((builder) => {
    const category = ['X Axis'];
    builder.addFieldNamePicker({
        path: 'xField',
        name: 'X Field',
        description: 'An increasing numeric value',
        category,
        defaultValue: undefined,
        settings: {
            isClearable: true,
            placeholderText: 'First numeric value',
            filter: (field) => field.type === FieldType.number,
        },
    });
    commonOptionsBuilder.addTooltipOptions(builder);
    commonOptionsBuilder.addLegendOptions(builder);
})
    .setSuggestionsSupplier(new TrendSuggestionsSupplier());
//.setDataSupport({ annotations: true, alertStates: true });
//# sourceMappingURL=module.js.map