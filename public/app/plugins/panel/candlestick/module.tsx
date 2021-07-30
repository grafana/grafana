import { FieldColorModeId, FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { CandlestickPanel } from './CandlestickPanel';
import { commonOptionsBuilder } from '@grafana/ui';
import { PanelOptions, PanelFieldConfig } from './models.gen';
import { candlestickFields } from './types';
import { capitalize } from 'lodash';

export const plugin = new PanelPlugin<PanelOptions, PanelFieldConfig>(CandlestickPanel)
  .setPanelOptions((builder) => {
    builder
      .addRadio({
        path: 'mode',
        name: 'Mode',
        settings: {
          options: [
            { value: 'candlestick', label: 'Candlestick' },
            { value: 'ohlc', label: 'OHLC' },
            { value: 'volume', label: 'Volume' },
          ],
        },
        defaultValue: 'candlestick',
      })
      .addColorPicker({
        path: 'up',
        name: 'Up color',
        defaultValue: '#0F0',
      })
      .addColorPicker({
        path: 'down',
        name: 'Down color',
        defaultValue: '#F00',
      });

    candlestickFields.forEach((f) => {
      builder.addFieldNamePicker({
        category: ['Field names'],
        path: `names.${f}`,
        name: capitalize(f),
      });
    });
  })
  .useFieldConfig({
    standardOptions: {
      [FieldConfigProperty.Color]: {
        settings: {
          byValueSupport: false,
        },
        defaultValue: {
          mode: FieldColorModeId.PaletteClassic,
        },
      },
    },
    useCustomConfig: (builder) => {
      commonOptionsBuilder.addHideFrom(builder);
    },
  });
