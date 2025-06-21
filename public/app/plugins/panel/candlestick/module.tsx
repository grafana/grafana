import { Field, FieldType, getFieldDisplayName, PanelOptionsEditorBuilder, PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { GraphFieldConfig } from '@grafana/schema';
import { commonOptionsBuilder } from '@grafana/ui';

import { defaultGraphConfig, getGraphFieldConfig } from '../timeseries/config';

import { CandlestickPanel } from './CandlestickPanel';
import { CandlestickData, getCandlestickFieldsInfo, FieldPickerInfo, prepareCandlestickFields } from './fields';
import { CandlestickSuggestionsSupplier } from './suggestions';
import { defaultCandlestickColors, defaultOptions, Options, VizDisplayMode, ColorStrategy, CandleStyle } from './types';

const numericFieldFilter = (f: Field) => f.type === FieldType.number;

function addFieldPicker(
  builder: PanelOptionsEditorBuilder<Options>,
  info: FieldPickerInfo,
  data: CandlestickData | null,
  category?: string[]
) {
  let placeholderText = 'Auto ';

  if (data) {
    const current = data[info.key];

    if (current?.config) {
      placeholderText += '= ' + getFieldDisplayName(current);

      if (current === data?.open && info.key !== 'open') {
        placeholderText += ` (${info.defaults.join(',')})`;
      }
    } else {
      placeholderText += `(${info.defaults.join(',')})`;
    }
  }

  builder.addFieldNamePicker({
    path: `fields.${info.key}`,
    name: info.name,
    description: info.description,
    category,
    settings: {
      filter: numericFieldFilter,
      placeholderText,
    },
  });
}

export const plugin = new PanelPlugin<Options, GraphFieldConfig>(CandlestickPanel)
  .useFieldConfig(getGraphFieldConfig(defaultGraphConfig))
  .setPanelOptions((builder, context) => {
    const category = [t('candlestick.category-candlestick', 'Candlestick')];
    const opts = context.options ?? defaultOptions;
    const info = prepareCandlestickFields(context.data, opts, config.theme2);
    builder
      .addRadio({
        path: 'mode',
        name: t('candlestick.name-mode', 'Mode'),
        category,
        description: '',
        defaultValue: defaultOptions.mode,
        settings: {
          options: [
            { label: t('candlestick.mode-options.label-candles', 'Candles'), value: VizDisplayMode.Candles },
            { label: t('candlestick.mode-options.label-volume', 'Volume'), value: VizDisplayMode.Volume },
            { label: t('candlestick.mode-options.label-both', 'Both'), value: VizDisplayMode.CandlesVolume },
          ],
        },
      })
      .addRadio({
        path: 'candleStyle',
        name: t('candlestick.name-candle-style', 'Candle style'),
        category,
        description: '',
        defaultValue: defaultOptions.candleStyle,
        settings: {
          options: [
            { label: t('candlestick.candle-style-options.label-candles', 'Candles'), value: CandleStyle.Candles },
            { label: t('candlestick.candle-style-options.label-ohlc-bars', 'OHLC Bars'), value: CandleStyle.OHLCBars },
          ],
        },
        showIf: (opts) => opts.mode !== VizDisplayMode.Volume,
      })
      .addRadio({
        path: 'colorStrategy',
        name: t('candlestick.name-color-strategy', 'Color strategy'),
        category,
        description: '',
        defaultValue: defaultOptions.colorStrategy,
        settings: {
          options: [
            {
              label: t('candlestick.color-strategy-options.label-since-open', 'Since Open'),
              value: ColorStrategy.OpenClose,
            },
            {
              label: t('candlestick.color-strategy-options.label-since-prior-close', 'Since Prior Close'),
              value: ColorStrategy.CloseClose,
            },
          ],
        },
      })
      .addColorPicker({
        path: 'colors.up',
        name: t('candlestick.name-up-color', 'Up color'),
        category,
        defaultValue: defaultCandlestickColors.up,
      })
      .addColorPicker({
        path: 'colors.down',
        name: t('candlestick.name-down-color', 'Down color'),
        category,
        defaultValue: defaultCandlestickColors.down,
      });

    const candlestickFieldsInfo = getCandlestickFieldsInfo();
    addFieldPicker(builder, candlestickFieldsInfo.open, info, category);
    if (opts.mode !== VizDisplayMode.Volume) {
      addFieldPicker(builder, candlestickFieldsInfo.high, info, category);
      addFieldPicker(builder, candlestickFieldsInfo.low, info, category);
    }
    addFieldPicker(builder, candlestickFieldsInfo.close, info, category);

    if (opts.mode !== VizDisplayMode.Candles) {
      addFieldPicker(builder, candlestickFieldsInfo.volume, info, category);
    }

    builder.addRadio({
      path: 'includeAllFields',
      name: t('candlestick.name-additional-fields', 'Additional fields'),
      category,
      description: t(
        'candlestick.description-additional-fields',
        'Use standard timeseries options to configure any fields not mapped above'
      ),
      defaultValue: defaultOptions.includeAllFields,
      settings: {
        options: [
          { label: t('candlestick.additional-fields-options.label-ignore', 'Ignore'), value: false },
          { label: t('candlestick.additional-fields-options.label-include', 'Include'), value: true },
        ],
      },
    });

    commonOptionsBuilder.addTooltipOptions(builder, false, true);
    commonOptionsBuilder.addLegendOptions(builder);
  })
  .setDataSupport({ annotations: true, alertStates: true })
  .setSuggestionsSupplier(new CandlestickSuggestionsSupplier());
