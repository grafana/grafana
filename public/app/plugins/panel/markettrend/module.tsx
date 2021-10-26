import { GraphFieldConfig } from '@grafana/schema';
import { PanelPlugin, SelectableValue } from '@grafana/data';
import { commonOptionsBuilder } from '@grafana/ui';
import { MarketTrendPanel } from './MarketTrendPanel';
import { MarketOptions, MarketTrendMode, PriceDrawStyle } from './types';
import { defaultGraphConfig, getGraphFieldConfig } from '../timeseries/config';

const modeOptions = [
  { label: 'Price', value: MarketTrendMode.Price },
  { label: 'Volume', value: MarketTrendMode.Volume },
] as Array<SelectableValue<MarketTrendMode>>;

const drawStyle = [
  { label: 'Candles', value: PriceDrawStyle.Candles },
  { label: 'Bars', value: PriceDrawStyle.Bars },
] as Array<SelectableValue<PriceDrawStyle>>;

const calcModes = [
  { label: 'Close vs Close', value: 'inter-period' },
  { label: 'Open vs Close', value: 'intra-period' },
] as Array<SelectableValue<unknown>>;

export const plugin = new PanelPlugin<MarketOptions, GraphFieldConfig>(MarketTrendPanel)
  .useFieldConfig(getGraphFieldConfig(defaultGraphConfig))
  .setPanelOptions((builder) => {
    builder
      .addRadio({
        path: 'mode',
        name: 'Mode',
        description: '',
        defaultValue: MarketTrendMode.Price,
        settings: {
          options: modeOptions,
        },
      })
      .addRadio({
        path: 'drawStyle',
        name: 'Draw style',
        description: '',
        defaultValue: PriceDrawStyle.Candles,
        settings: {
          options: drawStyle,
        },
        showIf: (opts) => opts.mode === MarketTrendMode.Price,
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
      })
      .addSelect({
        path: 'strokeMode',
        name: 'Stroke mode',
        settings: {
          options: calcModes,
        },
      })
      .addFieldNamePicker({
        path: 'fieldMap.volume',
        name: 'Volume field',
        showIf: (opts) => opts.mode === MarketTrendMode.Volume,
      })
      .addFieldNamePicker({
        path: 'fieldMap.open',
        name: 'Open field',
      })
      .addFieldNamePicker({
        path: 'fieldMap.high',
        name: 'High field',
        showIf: (opts) => opts.mode === MarketTrendMode.Price,
      })
      .addFieldNamePicker({
        path: 'fieldMap.low',
        name: 'Low field',
        showIf: (opts) => opts.mode === MarketTrendMode.Price,
      })
      .addFieldNamePicker({
        path: 'fieldMap.close',
        name: 'Close field',
      });

    // color picker for up / down
    // filled / empty picker (derived field)

    commonOptionsBuilder.addTooltipOptions(builder);
    commonOptionsBuilder.addLegendOptions(builder);
  })
  .setDataSupport({ annotations: true, alertStates: true });
