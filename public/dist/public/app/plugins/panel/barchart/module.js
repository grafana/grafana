var _a;
import { __values } from "tslib";
import { FieldColorModeId, FieldConfigProperty, FieldType, PanelPlugin, VizOrientation, } from '@grafana/data';
import { BarChartPanel } from './BarChartPanel';
import { StackingMode, VisibilityMode } from '@grafana/schema';
import { graphFieldOptions, commonOptionsBuilder } from '@grafana/ui';
import { defaultBarChartFieldConfig } from 'app/plugins/panel/barchart/types';
import { BarChartSuggestionsSupplier } from './suggestions';
export var plugin = new PanelPlugin(BarChartPanel)
    .useFieldConfig({
    standardOptions: (_a = {},
        _a[FieldConfigProperty.Color] = {
            settings: {
                byValueSupport: true,
                preferThresholdsMode: false,
            },
            defaultValue: {
                mode: FieldColorModeId.PaletteClassic,
            },
        },
        _a),
    useCustomConfig: function (builder) {
        var cfg = defaultBarChartFieldConfig;
        builder
            .addSliderInput({
            path: 'lineWidth',
            name: 'Line width',
            defaultValue: cfg.lineWidth,
            settings: {
                min: 0,
                max: 10,
                step: 1,
            },
        })
            .addSliderInput({
            path: 'fillOpacity',
            name: 'Fill opacity',
            defaultValue: cfg.fillOpacity,
            settings: {
                min: 0,
                max: 100,
                step: 1,
            },
        })
            .addRadio({
            path: 'gradientMode',
            name: 'Gradient mode',
            defaultValue: graphFieldOptions.fillGradient[0].value,
            settings: {
                options: graphFieldOptions.fillGradient,
            },
        });
        commonOptionsBuilder.addAxisConfig(builder, cfg, true);
        commonOptionsBuilder.addHideFrom(builder);
    },
})
    .setPanelOptions(function (builder) {
    builder
        .addRadio({
        path: 'orientation',
        name: 'Orientation',
        settings: {
            options: [
                { value: VizOrientation.Auto, label: 'Auto' },
                { value: VizOrientation.Horizontal, label: 'Horizontal' },
                { value: VizOrientation.Vertical, label: 'Vertical' },
            ],
        },
        defaultValue: VizOrientation.Auto,
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
        defaultValue: VisibilityMode.Auto,
    })
        .addRadio({
        path: 'stacking',
        name: 'Stacking',
        settings: {
            options: graphFieldOptions.stacking,
        },
        defaultValue: StackingMode.None,
    })
        .addSliderInput({
        path: 'groupWidth',
        name: 'Group width',
        defaultValue: 0.7,
        settings: {
            min: 0,
            max: 1,
            step: 0.01,
        },
        showIf: function (c, data) {
            if (c.stacking && c.stacking !== StackingMode.None) {
                return false;
            }
            return countNumberFields(data) !== 1;
        },
    })
        .addSliderInput({
        path: 'barWidth',
        name: 'Bar width',
        defaultValue: 0.97,
        settings: {
            min: 0,
            max: 1,
            step: 0.01,
        },
    });
    commonOptionsBuilder.addTooltipOptions(builder);
    commonOptionsBuilder.addLegendOptions(builder);
    commonOptionsBuilder.addTextSizeOptions(builder, false);
})
    .setSuggestionsSupplier(new BarChartSuggestionsSupplier());
function countNumberFields(data) {
    var e_1, _a, e_2, _b;
    var count = 0;
    if (data) {
        try {
            for (var data_1 = __values(data), data_1_1 = data_1.next(); !data_1_1.done; data_1_1 = data_1.next()) {
                var frame = data_1_1.value;
                try {
                    for (var _c = (e_2 = void 0, __values(frame.fields)), _d = _c.next(); !_d.done; _d = _c.next()) {
                        var field = _d.value;
                        if (field.type === FieldType.number) {
                            count++;
                        }
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
                    }
                    finally { if (e_2) throw e_2.error; }
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (data_1_1 && !data_1_1.done && (_a = data_1.return)) _a.call(data_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
    }
    return count;
}
//# sourceMappingURL=module.js.map