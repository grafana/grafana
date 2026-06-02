import { PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';

import { OrderBookPanel } from './OrderBookPanel';
import { orderBookSuggestionsSupplier } from './suggestions';
import { BarAlign, defaultOptions, MidPriceSource, type Options } from './types';

export const plugin = new PanelPlugin<Options>(OrderBookPanel)
  .setPanelOptions((builder) => {
    const fieldCategory = [t('orderbook.category-fields', 'Fields')];
    const layoutCategory = [t('orderbook.category-layout', 'Layout')];

    builder
      .addFieldNamePicker({
        path: 'priceField',
        name: t('orderbook.option-price-field', 'Price field'),
        description: t(
          'orderbook.option-price-field-desc',
          'Numeric field with the price of each level. Auto-detected when empty.'
        ),
        category: fieldCategory,
      })
      .addFieldNamePicker({
        path: 'sizeField',
        name: t('orderbook.option-size-field', 'Size field'),
        description: t(
          'orderbook.option-size-field-desc',
          'Numeric field with the size/volume of each level. Auto-detected when empty.'
        ),
        category: fieldCategory,
      })
      .addFieldNamePicker({
        path: 'sideField',
        name: t('orderbook.option-side-field', 'Side field'),
        description: t(
          'orderbook.option-side-field-desc',
          'Field with the side (bid/buy or ask/sell). When empty, levels are split by the mid price.'
        ),
        category: fieldCategory,
      })
      .addRadio({
        path: 'midPriceSource',
        name: t('orderbook.option-mid-source', 'Mid price'),
        defaultValue: defaultOptions.midPriceSource,
        category: fieldCategory,
        settings: {
          options: [
            { value: MidPriceSource.Auto, label: t('orderbook.mid-auto', 'Auto') },
            { value: MidPriceSource.Field, label: t('orderbook.mid-field', 'From field') },
          ],
        },
      })
      .addFieldNamePicker({
        path: 'midPriceField',
        name: t('orderbook.option-mid-field', 'Mid price field'),
        category: fieldCategory,
        showIf: (opts) => opts.midPriceSource === MidPriceSource.Field,
      })
      .addNumberInput({
        path: 'maxLevels',
        name: t('orderbook.option-max-levels', 'Levels per side'),
        description: t('orderbook.option-max-levels-desc', 'Maximum number of levels shown per side (0 = all).'),
        defaultValue: defaultOptions.maxLevels,
        category: layoutCategory,
        settings: { min: 0, step: 1 },
      })
      .addColorPicker({
        path: 'askColor',
        name: t('orderbook.option-ask-color', 'Ask color'),
        defaultValue: defaultOptions.askColor,
        category: layoutCategory,
      })
      .addColorPicker({
        path: 'bidColor',
        name: t('orderbook.option-bid-color', 'Bid color'),
        defaultValue: defaultOptions.bidColor,
        category: layoutCategory,
      })
      .addRadio({
        path: 'barAlign',
        name: t('orderbook.option-bar-align', 'Bar alignment'),
        defaultValue: defaultOptions.barAlign,
        category: layoutCategory,
        settings: {
          options: [
            { value: BarAlign.Left, label: t('orderbook.align-left', 'Left') },
            { value: BarAlign.Right, label: t('orderbook.align-right', 'Right') },
          ],
        },
      })
      .addSliderInput({
        path: 'barGap',
        name: t('orderbook.option-bar-gap', 'Gap between bars'),
        description: t('orderbook.option-bar-gap-desc', 'Vertical gap between adjacent level bars, in pixels.'),
        defaultValue: defaultOptions.barGap,
        category: layoutCategory,
        settings: { min: 0, max: 8, step: 1 },
      })
      .addBooleanSwitch({
        path: 'showDepth',
        name: t('orderbook.option-show-depth', 'Show cumulative depth'),
        defaultValue: defaultOptions.showDepth,
        category: layoutCategory,
      })
      .addBooleanSwitch({
        path: 'showMidPrice',
        name: t('orderbook.option-show-mid', 'Show mid price'),
        defaultValue: defaultOptions.showMidPrice,
        category: layoutCategory,
      })
      .addBooleanSwitch({
        path: 'showDelta',
        name: t('orderbook.option-show-delta', 'Show delta column'),
        defaultValue: defaultOptions.showDelta,
        category: layoutCategory,
      })
      .addBooleanSwitch({
        path: 'showSize',
        name: t('orderbook.option-show-size', 'Show size column'),
        defaultValue: defaultOptions.showSize,
        category: layoutCategory,
      })
      .addBooleanSwitch({
        path: 'showSum',
        name: t('orderbook.option-show-sum', 'Show sum column'),
        defaultValue: defaultOptions.showSum,
        category: layoutCategory,
      });
  })
  .setSuggestionsSupplier(orderBookSuggestionsSupplier);
