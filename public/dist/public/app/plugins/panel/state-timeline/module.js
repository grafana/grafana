var _a;
import { FieldColorModeId, FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { StateTimelinePanel } from './StateTimelinePanel';
import { defaultPanelOptions, defaultTimelineFieldConfig } from './types';
import { VisibilityMode } from '@grafana/schema';
import { commonOptionsBuilder } from '@grafana/ui';
import { timelinePanelChangedHandler } from './migrations';
import { StatTimelineSuggestionsSupplier } from './suggestions';
export var plugin = new PanelPlugin(StateTimelinePanel)
    .setPanelChangeHandler(timelinePanelChangedHandler)
    .useFieldConfig({
    standardOptions: (_a = {},
        _a[FieldConfigProperty.Color] = {
            settings: {
                byValueSupport: true,
            },
            defaultValue: {
                mode: FieldColorModeId.ContinuousGrYlRd,
            },
        },
        _a),
    useCustomConfig: function (builder) {
        builder
            .addSliderInput({
            path: 'lineWidth',
            name: 'Line width',
            defaultValue: defaultTimelineFieldConfig.lineWidth,
            settings: {
                min: 0,
                max: 10,
                step: 1,
            },
        })
            .addSliderInput({
            path: 'fillOpacity',
            name: 'Fill opacity',
            defaultValue: defaultTimelineFieldConfig.fillOpacity,
            settings: {
                min: 0,
                max: 100,
                step: 1,
            },
        });
    },
})
    .setPanelOptions(function (builder) {
    builder
        .addBooleanSwitch({
        path: 'mergeValues',
        name: 'Merge equal consecutive values',
        defaultValue: defaultPanelOptions.mergeValues,
    })
        .addRadio({
        path: 'showValue',
        name: 'Show values',
        settings: {
            options: [
                { value: VisibilityMode.Auto, label: 'Auto' },
                { value: VisibilityMode.Always, label: 'Always' },
                { value: VisibilityMode.Never, label: 'Never' },
            ],
        },
        defaultValue: defaultPanelOptions.showValue,
    })
        .addRadio({
        path: 'alignValue',
        name: 'Align values',
        settings: {
            options: [
                { value: 'left', label: 'Left' },
                { value: 'center', label: 'Center' },
                { value: 'right', label: 'Right' },
            ],
        },
        defaultValue: defaultPanelOptions.alignValue,
    })
        .addSliderInput({
        path: 'rowHeight',
        name: 'Row height',
        settings: {
            min: 0,
            max: 1,
            step: 0.01,
        },
        defaultValue: defaultPanelOptions.rowHeight,
    });
    commonOptionsBuilder.addLegendOptions(builder, false);
    commonOptionsBuilder.addTooltipOptions(builder, true);
})
    .setSuggestionsSupplier(new StatTimelineSuggestionsSupplier());
//# sourceMappingURL=module.js.map