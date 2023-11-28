import { PanelPlugin } from '@grafana/data';
import { DataGridPanel } from './DataGridPanel';
import { defaultOptions } from './panelcfg.gen';
export const plugin = new PanelPlugin(DataGridPanel).setPanelOptions((builder, context) => {
    var _a;
    const seriesOptions = context.data.map((frame, idx) => ({ value: idx, label: frame.refId }));
    if (context.options &&
        !seriesOptions.map((s) => s.value).includes((_a = context.options.selectedSeries) !== null && _a !== void 0 ? _a : 0)) {
        context.options.selectedSeries = defaultOptions.selectedSeries;
    }
    return builder.addSelect({
        path: 'selectedSeries',
        name: 'Select series',
        defaultValue: defaultOptions.selectedSeries,
        settings: {
            options: seriesOptions,
        },
    });
});
//# sourceMappingURL=module.js.map