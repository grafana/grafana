import { GraphFieldConfig } from '@grafana/schema';
import {
  Field,
  FieldType,
  getFieldDisplayName,
  PanelOptionsEditorBuilder,
  PanelPlugin,
  SelectableValue,
} from '@grafana/data';
import { commonOptionsBuilder } from '@grafana/ui';
import { MarketTrendPanel } from './CandlestickPanel';
import {
  defaultColors,
  CandlestickOptions,
  VizDisplayMode,
  ColorStrategy,
  ValueStyle,
  defaultPanelOptions,
} from './models.gen';
import { defaultGraphConfig, getGraphFieldConfig } from '../timeseries/config';
import { CandlestickData, candlestickFieldsInfo, FieldPickerInfo, prepareCandlestickFields } from './fields';
import { config } from '@grafana/runtime';

const modeOptions = [
  { label: 'Price & Volume', value: VizDisplayMode.ValueVolume },
  { label: 'Price', value: VizDisplayMode.Value },
  { label: 'Volume', value: VizDisplayMode.Volume },
] as Array<SelectableValue<VizDisplayMode>>;

const priceStyle = [
  { label: 'Candles', value: ValueStyle.Candles },
  { label: 'OHLC Bars', value: ValueStyle.OHLCBars },
] as Array<SelectableValue<ValueStyle>>;

const colorStrategy = [
  { label: 'Since Open', value: 'intra' },
  { label: 'Since Prior Close', value: 'inter' },
] as Array<SelectableValue<ColorStrategy>>;

const numericFieldFilter = (f: Field) => f.type === FieldType.number;

function addFieldPicker(
  builder: PanelOptionsEditorBuilder<CandlestickOptions>,
  info: FieldPickerInfo,
  data: CandlestickData
) {
  const current = data[info.key] as Field;
  let placeholderText = 'Auto ';
  if (current?.config) {
    placeholderText += '= ' + getFieldDisplayName(current);

    if (current === data?.open && info.key !== 'open') {
      placeholderText += ` (${info.defaults.join(',')})`;
    }
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

export const plugin = new PanelPlugin<CandlestickOptions, GraphFieldConfig>(MarketTrendPanel)
  .useFieldConfig(getGraphFieldConfig(defaultGraphConfig))
  .setPanelOptions((builder, context) => {
    const opts = context.options ?? defaultPanelOptions;
    const info = prepareCandlestickFields(context.data, opts, config.theme2);

    builder
      .addRadio({
        path: 'mode',
        name: 'Mode',
        description: '',
        defaultValue: VizDisplayMode.ValueVolume,
        settings: {
          options: modeOptions,
        },
      })
      .addRadio({
        path: 'priceStyle',
        name: 'Price style',
        description: '',
        defaultValue: ValueStyle.Candles,
        settings: {
          options: priceStyle,
        },
        showIf: (opts) => opts.mode !== VizDisplayMode.Volume,
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

    addFieldPicker(builder, candlestickFieldsInfo.open, info);
    if (opts.mode !== VizDisplayMode.Volume) {
      addFieldPicker(builder, candlestickFieldsInfo.high, info);
      addFieldPicker(builder, candlestickFieldsInfo.low, info);
    }
    addFieldPicker(builder, candlestickFieldsInfo.close, info);

    if (opts.mode !== VizDisplayMode.Value) {
      addFieldPicker(builder, candlestickFieldsInfo.volume, info);
    }

    // commonOptionsBuilder.addTooltipOptions(builder);
    commonOptionsBuilder.addLegendOptions(builder);
  })
  .setDataSupport({ annotations: true, alertStates: true });
