import { commonOptionsBuilder, sharedSingleStatPanelChangedHandler } from '@grafana/ui';
import { PanelPlugin } from '@grafana/data';
import { BarGaugePanel } from './BarGaugePanel';
import { displayModes } from './types';
import { addOrientationOption, addStandardDataReduceOptions } from '../stat/types';
import { barGaugePanelMigrationHandler } from './BarGaugeMigrations';
import { BarGaugeSuggestionsSupplier } from './suggestions';
export var plugin = new PanelPlugin(BarGaugePanel)
    .useFieldConfig()
    .setPanelOptions(function (builder) {
    addStandardDataReduceOptions(builder);
    addOrientationOption(builder);
    commonOptionsBuilder.addTextSizeOptions(builder);
    builder
        .addRadio({
        path: 'displayMode',
        name: 'Display mode',
        settings: {
            options: displayModes,
        },
        defaultValue: 'gradient',
    })
        .addBooleanSwitch({
        path: 'showUnfilled',
        name: 'Show unfilled area',
        description: 'When enabled renders the unfilled region as gray',
        defaultValue: true,
        showIf: function (options) { return options.displayMode !== 'lcd'; },
    });
})
    .setPanelChangeHandler(sharedSingleStatPanelChangedHandler)
    .setMigrationHandler(barGaugePanelMigrationHandler)
    .setSuggestionsSupplier(new BarGaugeSuggestionsSupplier());
//# sourceMappingURL=module.js.map