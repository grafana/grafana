import { GraphFieldConfig } from '@grafana/schema';
import { FieldConfigProperty, PanelPlugin, SelectableValue } from '@grafana/data';
import { commonOptionsBuilder } from '@grafana/ui';
import { MarketTrendPanel } from './MarketTrendPanel';
import { defaultColors, MarketOptions, MarketTrendMode, ColorStrategy, PriceStyle } from './models.gen';
import { defaultGraphConfig, getGraphFieldConfig } from '../timeseries/config';

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

export const plugin = new PanelPlugin<MarketOptions, GraphFieldConfig>(MarketTrendPanel)
  .useFieldConfig(getMarketFieldConfig())
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

    // commonOptionsBuilder.addTooltipOptions(builder);
    commonOptionsBuilder.addLegendOptions(builder);
  })
  .setDataSupport({ annotations: true, alertStates: true });
