import { standardEditorsRegistry } from '@grafana/data';
import { LegendDisplayMode } from '@grafana/schema';
/**
 * @alpha
 */
export function addLegendOptions(builder, includeLegendCalcs) {
    if (includeLegendCalcs === void 0) { includeLegendCalcs = true; }
    builder
        .addRadio({
        path: 'legend.displayMode',
        name: 'Legend mode',
        category: ['Legend'],
        description: '',
        defaultValue: LegendDisplayMode.List,
        settings: {
            options: [
                { value: LegendDisplayMode.List, label: 'List' },
                { value: LegendDisplayMode.Table, label: 'Table' },
                { value: LegendDisplayMode.Hidden, label: 'Hidden' },
            ],
        },
    })
        .addRadio({
        path: 'legend.placement',
        name: 'Legend placement',
        category: ['Legend'],
        description: '',
        defaultValue: 'bottom',
        settings: {
            options: [
                { value: 'bottom', label: 'Bottom' },
                { value: 'right', label: 'Right' },
            ],
        },
        showIf: function (c) { return c.legend.displayMode !== LegendDisplayMode.Hidden; },
    });
    if (includeLegendCalcs) {
        builder.addCustomEditor({
            id: 'legend.calcs',
            path: 'legend.calcs',
            name: 'Legend values',
            category: ['Legend'],
            description: 'Select values or calculations to show in legend',
            editor: standardEditorsRegistry.get('stats-picker').editor,
            defaultValue: [],
            settings: {
                allowMultiple: true,
            },
            showIf: function (currentConfig) { return currentConfig.legend.displayMode !== LegendDisplayMode.Hidden; },
        });
    }
}
//# sourceMappingURL=legend.js.map