import { GraphFieldConfig } from '@grafana/schema';
import { PanelPlugin, SelectableValue } from '@grafana/data';
import { commonOptionsBuilder } from '@grafana/ui';
import { MarketTrendPanel } from './MarketTrendPanel';
import { MarketOptions, MarketTrendMode, MovementMode, PriceDrawStyle } from './types';
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

const movementMode = [
  // up/down color depends on current close vs prior close
  // filled/hollow depends on current close vs current open
  { label: 'Hollow', value: 'hollow' },
  // up/down color depends on current close vs current open
  // filled always
  { label: 'Solid', value: 'solid' },
] as Array<SelectableValue<MovementMode>>;

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
      .addRadio({
        path: 'movementMode',
        name: 'Movement mode',
        description: '',
        defaultValue: MovementMode.Hollow,
        settings: {
          options: movementMode,
        },
        showIf: (opts) => opts.mode !== MarketTrendMode.Volume && opts.priceStyle === PriceDrawStyle.Candles,
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

    commonOptionsBuilder.addTooltipOptions(builder);
    commonOptionsBuilder.addLegendOptions(builder);
  })
  .setDataSupport({ annotations: true, alertStates: true });
