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
  defaultPanelOptions,
  DrawStyle,
} from './models.gen';
import { defaultGraphConfig, getGraphFieldConfig } from '../timeseries/config';
import { CandlestickData, candlestickFieldsInfo, FieldPickerInfo, prepareCandlestickFields } from './fields';
import { config } from '@grafana/runtime';

const modeOptions = [
  { label: 'Both', value: VizDisplayMode.CandlesVolume },
  { label: 'Candles', value: VizDisplayMode.Candles },
  { label: 'Volume', value: VizDisplayMode.Volume },
] as Array<SelectableValue<VizDisplayMode>>;

const drawStyles = [
  { label: 'Candles', value: DrawStyle.Candles },
  { label: 'OHLC Bars', value: DrawStyle.OHLCBars },
] as Array<SelectableValue<DrawStyle>>;

const colorStrategies = [
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
        defaultValue: defaultPanelOptions.mode,
        settings: {
          options: modeOptions,
        },
      })
      .addRadio({
        path: 'drawStyle',
        name: 'Draw style',
        description: '',
        defaultValue: defaultPanelOptions.drawStyle,
        settings: {
          options: drawStyles,
        },
        showIf: (opts) => opts.mode !== VizDisplayMode.Volume,
      })
      .addRadio({
        path: 'colorStrategy',
        name: 'Color strategy',
        description: '',
        defaultValue: defaultPanelOptions.colorStrategy,
        settings: {
          options: colorStrategies,
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

    if (opts.mode !== VizDisplayMode.Candles) {
      addFieldPicker(builder, candlestickFieldsInfo.volume, info);
    }

    // commonOptionsBuilder.addTooltipOptions(builder);
    commonOptionsBuilder.addLegendOptions(builder);
  })
  .setDataSupport({ annotations: true, alertStates: true });
