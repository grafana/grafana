import { FieldType, getFieldDisplayName, PanelPlugin, } from '@grafana/data';
import { config } from '@grafana/runtime';
import { commonOptionsBuilder } from '@grafana/ui';
import { defaultGraphConfig, getGraphFieldConfig } from '../timeseries/config';
import { CandlestickPanel } from './CandlestickPanel';
import { candlestickFieldsInfo, prepareCandlestickFields } from './fields';
import { CandlestickSuggestionsSupplier } from './suggestions';
import { defaultCandlestickColors, defaultOptions, VizDisplayMode, ColorStrategy, CandleStyle } from './types';
const modeOptions = [
    { label: 'Candles', value: VizDisplayMode.Candles },
    { label: 'Volume', value: VizDisplayMode.Volume },
    { label: 'Both', value: VizDisplayMode.CandlesVolume },
];
const candleStyles = [
    { label: 'Candles', value: CandleStyle.Candles },
    { label: 'OHLC Bars', value: CandleStyle.OHLCBars },
];
const colorStrategies = [
    { label: 'Since Open', value: ColorStrategy.OpenClose },
    { label: 'Since Prior Close', value: ColorStrategy.CloseClose },
];
const numericFieldFilter = (f) => f.type === FieldType.number;
function addFieldPicker(builder, info, data) {
    let placeholderText = 'Auto ';
    if (data) {
        const current = data[info.key];
        if (current === null || current === void 0 ? void 0 : current.config) {
            placeholderText += '= ' + getFieldDisplayName(current);
            if (current === (data === null || data === void 0 ? void 0 : data.open) && info.key !== 'open') {
                placeholderText += ` (${info.defaults.join(',')})`;
            }
        }
        else {
            placeholderText += `(${info.defaults.join(',')})`;
        }
    }
    builder.addFieldNamePicker({
        path: `fields.${info.key}`,
        name: info.name,
        description: info.description,
        settings: {
            filter: numericFieldFilter,
            placeholderText,
        },
    });
}
export const plugin = new PanelPlugin(CandlestickPanel)
    .useFieldConfig(getGraphFieldConfig(defaultGraphConfig))
    .setPanelOptions((builder, context) => {
    var _a;
    const opts = (_a = context.options) !== null && _a !== void 0 ? _a : defaultOptions;
    const info = prepareCandlestickFields(context.data, opts, config.theme2);
    builder
        .addRadio({
        path: 'mode',
        name: 'Mode',
        description: '',
        defaultValue: defaultOptions.mode,
        settings: {
            options: modeOptions,
        },
    })
        .addRadio({
        path: 'candleStyle',
        name: 'Candle style',
        description: '',
        defaultValue: defaultOptions.candleStyle,
        settings: {
            options: candleStyles,
        },
        showIf: (opts) => opts.mode !== VizDisplayMode.Volume,
    })
        .addRadio({
        path: 'colorStrategy',
        name: 'Color strategy',
        description: '',
        defaultValue: defaultOptions.colorStrategy,
        settings: {
            options: colorStrategies,
        },
    })
        .addColorPicker({
        path: 'colors.up',
        name: 'Up color',
        defaultValue: defaultCandlestickColors.up,
    })
        .addColorPicker({
        path: 'colors.down',
        name: 'Down color',
        defaultValue: defaultCandlestickColors.down,
    });
    addFieldPicker(builder, candlestickFieldsInfo.open, info);
    if (opts.mode !== VizDisplayMode.Volume) {
        addFieldPicker(builder, candlestickFieldsInfo.high, info);
        addFieldPicker(builder, candlestickFieldsInfo.low, info);
    }
    addFieldPicker(builder, candlestickFieldsInfo.close, info);
    if (opts.mode !== VizDisplayMode.Candles) {
        addFieldPicker(builder, candlestickFieldsInfo.volume, info);
    }
    builder.addRadio({
        path: 'includeAllFields',
        name: 'Additional fields',
        description: 'Use standard timeseries options to configure any fields not mapped above',
        defaultValue: defaultOptions.includeAllFields,
        settings: {
            options: [
                { label: 'Ignore', value: false },
                { label: 'Include', value: true },
            ],
        },
    });
    // commonOptionsBuilder.addTooltipOptions(builder);
    commonOptionsBuilder.addLegendOptions(builder);
})
    .setDataSupport({ annotations: true, alertStates: true })
    .setSuggestionsSupplier(new CandlestickSuggestionsSupplier());
//# sourceMappingURL=module.js.map