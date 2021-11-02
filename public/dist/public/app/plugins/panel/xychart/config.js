import { FieldColorModeId, FieldConfigProperty, FieldType, identityOverrideProcessor, } from '@grafana/data';
import { VisibilityMode } from '@grafana/schema';
import { commonOptionsBuilder, graphFieldOptions } from '@grafana/ui';
import { LineStyleEditor } from '../timeseries/LineStyleEditor';
import { ScatterLineMode } from './models.gen';
var categoryStyles = undefined; // ['Scatter styles'];
export function getScatterFieldConfig(cfg) {
    var _a;
    return {
        standardOptions: (_a = {},
            _a[FieldConfigProperty.Color] = {
                settings: {
                    byValueSupport: true,
                    bySeriesSupport: true,
                    preferThresholdsMode: false,
                },
                defaultValue: {
                    mode: FieldColorModeId.PaletteClassic,
                },
            },
            _a),
        useCustomConfig: function (builder) {
            var _a;
            builder
                .addRadio({
                path: 'point',
                name: 'Points',
                category: categoryStyles,
                defaultValue: cfg.point,
                settings: {
                    options: graphFieldOptions.showPoints,
                },
            })
                .addSliderInput({
                path: 'pointSize.fixed',
                name: 'Point size',
                category: categoryStyles,
                defaultValue: (_a = cfg.pointSize) === null || _a === void 0 ? void 0 : _a.fixed,
                settings: {
                    min: 1,
                    max: 100,
                    step: 1,
                },
                showIf: function (c) { return c.point !== VisibilityMode.Never; },
            })
                .addRadio({
                path: 'line',
                name: 'Lines',
                category: categoryStyles,
                defaultValue: cfg.line,
                settings: {
                    options: [
                        { label: 'None', value: ScatterLineMode.None },
                        { label: 'Linear', value: ScatterLineMode.Linear },
                    ],
                },
            })
                .addCustomEditor({
                id: 'lineStyle',
                path: 'lineStyle',
                name: 'Line style',
                category: categoryStyles,
                showIf: function (c) { return c.line !== ScatterLineMode.None; },
                editor: LineStyleEditor,
                override: LineStyleEditor,
                process: identityOverrideProcessor,
                shouldApply: function (f) { return f.type === FieldType.number; },
            })
                .addSliderInput({
                path: 'lineWidth',
                name: 'Line width',
                category: categoryStyles,
                defaultValue: cfg.lineWidth,
                settings: {
                    min: 0,
                    max: 10,
                    step: 1,
                },
                showIf: function (c) { return c.line !== ScatterLineMode.None; },
            });
            commonOptionsBuilder.addAxisConfig(builder, cfg);
            commonOptionsBuilder.addHideFrom(builder);
        },
    };
}
//# sourceMappingURL=config.js.map