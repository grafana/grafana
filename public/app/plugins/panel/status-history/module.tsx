import { FieldColorModeId, FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { AxisPlacement, VisibilityMode } from '@grafana/schema';
import { commonOptionsBuilder } from '@grafana/ui';

import { StatusHistoryPanel } from './StatusHistoryPanel';
import { Options, FieldConfig, defaultFieldConfig } from './panelcfg.gen';
import { StatusHistorySuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin<Options, FieldConfig>(StatusHistoryPanel)
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
      [FieldConfigProperty.Links]: {
        settings: {
          showOneClick: true,
        },
      },
      [FieldConfigProperty.Actions]: {
        hideFromDefaults: false,
      },
    },
    useCustomConfig: (builder) => {
      builder
        .addSliderInput({
          path: 'lineWidth',
          name: 'Line width',
          defaultValue: defaultFieldConfig.lineWidth,
          settings: {
            min: 0,
            max: 10,
            step: 1,
          },
        })
        .addSliderInput({
          path: 'fillOpacity',
          name: 'Fill opacity',
          defaultValue: defaultFieldConfig.fillOpacity,
          settings: {
            min: 0,
            max: 100,
            step: 1,
          },
        });

      commonOptionsBuilder.addHideFrom(builder);
      commonOptionsBuilder.addAxisPlacement(
        builder,
        (placement) => placement === AxisPlacement.Auto || placement === AxisPlacement.Hidden
      );
      commonOptionsBuilder.addAxisWidth(builder);
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
      })
      .addNumberInput({
        path: 'perPage',
        name: 'Page size (enable pagination)',
        settings: {
          min: 1,
          step: 1,
          integer: true,
        },
      });

    commonOptionsBuilder.addLegendOptions(builder, false);
    commonOptionsBuilder.addTooltipOptions(builder);
  })
  .setSuggestionsSupplier(new StatusHistorySuggestionsSupplier())
  .setDataSupport({ annotations: true });
