import { GraphFieldConfig } from '@grafana/schema';
import { PanelPlugin, SelectableValue } from '@grafana/data';
import { commonOptionsBuilder } from '@grafana/ui';
import { MarketTrendPanel } from './MarketTrendPanel';
import { MarketOptions, MarketTrendMode, MovementCalc, PriceDrawStyle } from './types';
import { defaultGraphConfig, getGraphFieldConfig } from '../timeseries/config';

const modeOptions = [
  { label: 'Price', value: MarketTrendMode.Price },
  { label: 'Volume', value: MarketTrendMode.Volume },
  { label: 'Both', value: MarketTrendMode.PriceVolume },
] as Array<SelectableValue<MarketTrendMode>>;

const priceStyle = [
  { label: 'Candles', value: PriceDrawStyle.Candles },
  { label: 'Bars', value: PriceDrawStyle.Bars },
] as Array<SelectableValue<PriceDrawStyle>>;

const calcModes = [
  { label: 'Close vs Close', value: 'inter' },
  { label: 'Open vs Close', value: 'intra' },
] as Array<SelectableValue<MovementCalc>>;

export const plugin = new PanelPlugin<MarketOptions, GraphFieldConfig>(MarketTrendPanel)
  .useFieldConfig(getGraphFieldConfig(defaultGraphConfig))
  .setPanelOptions((builder) => {
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
        defaultValue: PriceDrawStyle.Candles,
        settings: {
          options: priceStyle,
        },
        showIf: (opts) => opts.mode !== MarketTrendMode.Volume,
      })
      .addColorPicker({
        path: 'upColor',
        name: 'Up color',
      })
      .addColorPicker({
        path: 'downColor',
        name: 'Down color',
      })
      .addColorPicker({
        path: 'flatColor',
        name: 'Flat color',
      })
      .addSelect({
        path: 'fillMode',
        name: 'Fill mode',
        settings: {
          options: calcModes,
        },
        showIf: (opts) => opts.mode !== MarketTrendMode.Volume && opts.priceStyle === PriceDrawStyle.Candles,
      })
      .addSelect({
        path: 'strokeMode',
        name: 'Stroke mode',
        settings: {
          options: calcModes,
        },
      })
      .addFieldNamePicker({
        path: 'fieldMap.open',
        name: 'Open field',
      })
      .addFieldNamePicker({
        path: 'fieldMap.high',
        name: 'High field',
        showIf: (opts) => opts.mode !== MarketTrendMode.Volume,
      })
      .addFieldNamePicker({
        path: 'fieldMap.low',
        name: 'Low field',
        showIf: (opts) => opts.mode !== MarketTrendMode.Volume,
      })
      .addFieldNamePicker({
        path: 'fieldMap.close',
        name: 'Close field',
      })
      .addFieldNamePicker({
        path: 'fieldMap.volume',
        name: 'Volume field',
        showIf: (opts) => opts.mode !== MarketTrendMode.Price,
      });

    // color picker for up / down
    // filled / empty picker (derived field)

    commonOptionsBuilder.addTooltipOptions(builder);
    commonOptionsBuilder.addLegendOptions(builder);
  })
  .setDataSupport({ annotations: true, alertStates: true });
