import { PanelPlugin } from '@grafana/data';
import { commonOptionsBuilder } from '@grafana/ui';
import { defaultScatterConfig } from './models.gen';
import { getScatterFieldConfig } from './config';
import { XYDimsEditor } from './XYDimsEditor';
import { XYChartPanel2 } from './XYChartPanel2';
import { ColorDimensionEditor, ScaleDimensionEditor } from 'app/features/dimensions/editors';
export var plugin = new PanelPlugin(XYChartPanel2)
    .useFieldConfig(getScatterFieldConfig(defaultScatterConfig))
    .setPanelOptions(function (builder) {
    builder
        .addRadio({
        path: 'mode',
        name: 'Mode',
        defaultValue: 'single',
        settings: {
            options: [
                { value: 'xy', label: 'XY', description: 'No changes to saved model since 8.0' },
                { value: 'explicit', label: 'Explicit' },
            ],
        },
    })
        .addCustomEditor({
        id: 'xyPlotConfig',
        path: 'dims',
        name: 'Data',
        editor: XYDimsEditor,
        showIf: function (cfg) { return cfg.mode === 'xy'; },
    })
        .addFieldNamePicker({
        path: 'series[0].x',
        name: 'X Field',
        showIf: function (cfg) { return cfg.mode === 'explicit'; },
    })
        .addFieldNamePicker({
        path: 'series[0].y',
        name: 'Y Field',
        showIf: function (cfg) { return cfg.mode === 'explicit'; },
    })
        .addCustomEditor({
        id: 'seriesZerox.pointColor',
        path: 'series[0].pointColor',
        name: 'Point color',
        editor: ColorDimensionEditor,
        settings: {},
        defaultValue: {},
        showIf: function (cfg) { return cfg.mode === 'explicit'; },
    })
        .addCustomEditor({
        id: 'seriesZerox.pointSize',
        path: 'series[0].pointSize',
        name: 'Point size',
        editor: ScaleDimensionEditor,
        settings: {
            min: 1,
            max: 50,
        },
        defaultValue: {
            fixed: 5,
            min: 1,
            max: 50,
        },
        showIf: function (cfg) { return cfg.mode === 'explicit'; },
    });
    commonOptionsBuilder.addTooltipOptions(builder);
    commonOptionsBuilder.addLegendOptions(builder);
});
//# sourceMappingURL=module.js.map