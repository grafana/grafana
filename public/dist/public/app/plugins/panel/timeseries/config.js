import { FieldColorModeId, FieldConfigProperty, FieldType, identityOverrideProcessor, stringOverrideProcessor, } from '@grafana/data';
import { BarAlignment, GraphDrawStyle, GraphGradientMode, LineInterpolation, VisibilityMode, StackingMode, GraphTresholdsStyleMode, } from '@grafana/schema';
import { graphFieldOptions, commonOptionsBuilder } from '@grafana/ui';
import { LineStyleEditor } from './LineStyleEditor';
import { FillBellowToEditor } from './FillBelowToEditor';
import { SpanNullsEditor } from './SpanNullsEditor';
import { ThresholdsStyleEditor } from './ThresholdsStyleEditor';
export var defaultGraphConfig = {
    drawStyle: GraphDrawStyle.Line,
    lineInterpolation: LineInterpolation.Linear,
    lineWidth: 1,
    fillOpacity: 0,
    gradientMode: GraphGradientMode.None,
    barAlignment: BarAlignment.Center,
    stacking: {
        mode: StackingMode.None,
        group: 'A',
    },
    axisGridShow: true,
};
var categoryStyles = ['Graph styles'];
export function getGraphFieldConfig(cfg) {
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
            builder
                .addRadio({
                path: 'drawStyle',
                name: 'Style',
                category: categoryStyles,
                defaultValue: cfg.drawStyle,
                settings: {
                    options: graphFieldOptions.drawStyle,
                },
            })
                .addRadio({
                path: 'lineInterpolation',
                name: 'Line interpolation',
                category: categoryStyles,
                defaultValue: cfg.lineInterpolation,
                settings: {
                    options: graphFieldOptions.lineInterpolation,
                },
                showIf: function (c) { return c.drawStyle === GraphDrawStyle.Line; },
            })
                .addRadio({
                path: 'barAlignment',
                name: 'Bar alignment',
                category: categoryStyles,
                defaultValue: cfg.barAlignment,
                settings: {
                    options: graphFieldOptions.barAlignment,
                },
                showIf: function (c) { return c.drawStyle === GraphDrawStyle.Bars; },
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
                    ariaLabelForHandle: 'Line width',
                },
                showIf: function (c) { return c.drawStyle !== GraphDrawStyle.Points; },
            })
                .addSliderInput({
                path: 'fillOpacity',
                name: 'Fill opacity',
                category: categoryStyles,
                defaultValue: cfg.fillOpacity,
                settings: {
                    min: 0,
                    max: 100,
                    step: 1,
                    ariaLabelForHandle: 'Fill opacity',
                },
                showIf: function (c) { return c.drawStyle !== GraphDrawStyle.Points; },
            })
                .addRadio({
                path: 'gradientMode',
                name: 'Gradient mode',
                category: categoryStyles,
                defaultValue: graphFieldOptions.fillGradient[0].value,
                settings: {
                    options: graphFieldOptions.fillGradient,
                },
                showIf: function (c) { return c.drawStyle !== GraphDrawStyle.Points; },
            })
                .addCustomEditor({
                id: 'fillBelowTo',
                path: 'fillBelowTo',
                name: 'Fill below to',
                category: categoryStyles,
                editor: FillBellowToEditor,
                override: FillBellowToEditor,
                process: stringOverrideProcessor,
                hideFromDefaults: true,
                shouldApply: function (f) { return true; },
            })
                .addCustomEditor({
                id: 'lineStyle',
                path: 'lineStyle',
                name: 'Line style',
                category: categoryStyles,
                showIf: function (c) { return c.drawStyle === GraphDrawStyle.Line; },
                editor: LineStyleEditor,
                override: LineStyleEditor,
                process: identityOverrideProcessor,
                shouldApply: function (f) { return f.type === FieldType.number; },
            })
                .addCustomEditor({
                id: 'spanNulls',
                path: 'spanNulls',
                name: 'Connect null values',
                category: categoryStyles,
                defaultValue: false,
                editor: SpanNullsEditor,
                override: SpanNullsEditor,
                showIf: function (c) { return c.drawStyle === GraphDrawStyle.Line; },
                shouldApply: function (f) { return f.type !== FieldType.time; },
                process: identityOverrideProcessor,
            })
                .addRadio({
                path: 'showPoints',
                name: 'Show points',
                category: categoryStyles,
                defaultValue: graphFieldOptions.showPoints[0].value,
                settings: {
                    options: graphFieldOptions.showPoints,
                },
                showIf: function (c) { return c.drawStyle !== GraphDrawStyle.Points; },
            })
                .addSliderInput({
                path: 'pointSize',
                name: 'Point size',
                category: categoryStyles,
                defaultValue: 5,
                settings: {
                    min: 1,
                    max: 40,
                    step: 1,
                    ariaLabelForHandle: 'Point size',
                },
                showIf: function (c) { return c.showPoints !== VisibilityMode.Never || c.drawStyle === GraphDrawStyle.Points; },
            });
            commonOptionsBuilder.addStackingConfig(builder, cfg.stacking, categoryStyles);
            commonOptionsBuilder.addAxisConfig(builder, cfg);
            commonOptionsBuilder.addHideFrom(builder);
            builder.addCustomEditor({
                id: 'thresholdsStyle',
                path: 'thresholdsStyle',
                name: 'Show thresholds',
                category: ['Thresholds'],
                defaultValue: { mode: GraphTresholdsStyleMode.Off },
                settings: {
                    options: graphFieldOptions.thresholdsDisplayModes,
                },
                editor: ThresholdsStyleEditor,
                override: ThresholdsStyleEditor,
                process: identityOverrideProcessor,
                shouldApply: function () { return true; },
            });
        },
    };
}
//# sourceMappingURL=config.js.map