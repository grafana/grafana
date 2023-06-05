import { FieldColorModeId, FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { VisibilityMode } from '@grafana/schema';
import { commonOptionsBuilder } from '@grafana/ui';

import { StatusHistoryPanel } from './StatusHistoryPanel';
import { PanelOptions, PanelFieldConfig, defaultPanelFieldConfig } from './panelcfg.gen';
import { StatusHistorySuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin<PanelOptions, PanelFieldConfig>(StatusHistoryPanel)
  .useFieldConfig({
    standardOptions: {
      [FieldConfigProperty.Color]: {
        settings: {
          byValueSupport: true,
        },
        defaultValue: {
          mode: FieldColorModeId.Thresholds,
        },
      },
    },
    useCustomConfig: (builder) => {
      builder
        .addSliderInput({
          path: 'lineWidth',
          name: 'Line width',
          defaultValue: defaultPanelFieldConfig.lineWidth,
          settings: {
            min: 0,
            max: 10,
            step: 1,
          },
        })
        .addSliderInput({
          path: 'fillOpacity',
          name: 'Fill opacity',
          defaultValue: defaultPanelFieldConfig.fillOpacity,
          settings: {
            min: 0,
            max: 100,
            step: 1,
          },
        });
    },
  })
  .setPanelOptions((builder) => {
    builder
      .addRadio({
        path: 'showValue',
        name: 'Show values',
        settings: {
          options: [
            { value: VisibilityMode.Auto, label: 'Auto' },
            { value: VisibilityMode.Always, label: 'Always' },
            { value: VisibilityMode.Never, label: 'Never' },
          ],
        },
        defaultValue: VisibilityMode.Auto,
      })
      .addSliderInput({
        path: 'rowHeight',
        name: 'Row height',
        defaultValue: 0.9,
        settings: {
          min: 0,
          max: 1,
          step: 0.01,
        },
      })
      .addSliderInput({
        path: 'colWidth',
        name: 'Column width',
        defaultValue: 0.9,
        settings: {
          min: 0,
          max: 1,
          step: 0.01,
        },
      });

    commonOptionsBuilder.addLegendOptions(builder, false);
    commonOptionsBuilder.addTooltipOptions(builder, true);
  })
  .setSuggestionsSupplier(new StatusHistorySuggestionsSupplier());
