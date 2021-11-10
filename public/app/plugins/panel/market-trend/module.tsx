import { GraphFieldConfig } from '@grafana/schema';
import {
  Field,
  FieldConfigProperty,
  FieldType,
  getFieldDisplayName,
  PanelOptionsEditorBuilder,
  PanelPlugin,
  SelectableValue,
} from '@grafana/data';
import { commonOptionsBuilder } from '@grafana/ui';
import { MarketTrendPanel } from './MarketTrendPanel';
import {
  defaultColors,
  MarketOptions,
  MarketTrendMode,
  ColorStrategy,
  PriceStyle,
  defaultPanelOptions,
  CandlestickFieldMap,
} from './models.gen';
import { defaultGraphConfig, getGraphFieldConfig } from '../timeseries/config';
import { CandlestickData, candlestickFieldsInfo, FieldPickerInfo, prepareCandlestickFields } from './fields';
import { config } from '@grafana/runtime';

const modeOptions = [
  { label: 'Price & Volume', value: MarketTrendMode.PriceVolume },
  { label: 'Price', value: MarketTrendMode.Price },
  { label: 'Volume', value: MarketTrendMode.Volume },
] as Array<SelectableValue<MarketTrendMode>>;

const priceStyle = [
  { label: 'Candles', value: PriceStyle.Candles },
  { label: 'OHLC Bars', value: PriceStyle.OHLCBars },
] as Array<SelectableValue<PriceStyle>>;

const colorStrategy = [
  { label: 'Since Open', value: 'intra' },
  { label: 'Since Prior Close', value: 'inter' },
] as Array<SelectableValue<ColorStrategy>>;

function getMarketFieldConfig() {
  const v = getGraphFieldConfig(defaultGraphConfig);
  v.standardOptions![FieldConfigProperty.Unit] = {
    settings: {},
    defaultValue: 'currencyUSD',
  };
  return v;
}

const numericFieldFilter = (f: Field) => f.type === FieldType.number;

function addFieldPicker(
  builder: PanelOptionsEditorBuilder<MarketOptions>,
  info: FieldPickerInfo,
  mappings: CandlestickFieldMap,
  data?: CandlestickData
) {
  const current = (data as any)[info.key] as Field;
  let placeholderText = 'Auto ';
  if (current?.config) {
    placeholderText += '= ' + getFieldDisplayName(current);
  } else {
    placeholderText += `(${info.defaults.join(',')})`;
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

export const plugin = new PanelPlugin<MarketOptions, GraphFieldConfig>(MarketTrendPanel)
  .useFieldConfig(getMarketFieldConfig())
  .setPanelOptions((builder, context) => {
    const opts = context.options ?? defaultPanelOptions;
    const info = prepareCandlestickFields(context.data, config.theme2, opts);

    builder
      .addRadio({
        path: 'mode',
        name: 'Mode',
        description: '',
        defaultValue: MarketTrendMode.PriceVolume,
        settings: {
          options: modeOptions,
        },
      })
      .addRadio({
        path: 'priceStyle',
        name: 'Price style',
        description: '',
        defaultValue: PriceStyle.Candles,
        settings: {
          options: priceStyle,
        },
        showIf: (opts) => opts.mode !== MarketTrendMode.Volume,
      })
      .addRadio({
        path: 'colorStrategy',
        name: 'Color strategy',
        description: '',
        defaultValue: ColorStrategy.Intra,
        settings: {
          options: colorStrategy,
        },
      })
      .addColorPicker({
        path: 'colors.up',
        name: 'Up color',
        defaultValue: defaultColors.up,
      })
      .addColorPicker({
        path: 'colors.down',
        name: 'Down color',
        defaultValue: defaultColors.down,
      });

    addFieldPicker(builder, candlestickFieldsInfo.open, opts.fields, info);
    if (opts.mode !== MarketTrendMode.Volume) {
      addFieldPicker(builder, candlestickFieldsInfo.high, opts.fields, info);
      addFieldPicker(builder, candlestickFieldsInfo.low, opts.fields, info);
    }
    addFieldPicker(builder, candlestickFieldsInfo.close, opts.fields, info);

    if (opts.mode !== MarketTrendMode.Price) {
      addFieldPicker(builder, candlestickFieldsInfo.volume, opts.fields, info);
    }

    // commonOptionsBuilder.addTooltipOptions(builder);
    commonOptionsBuilder.addLegendOptions(builder);
  })
  .setDataSupport({ annotations: true, alertStates: true });
