import { FieldColorModeId, FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';
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
      const category = [t('status-history.category-status-history', 'Status history')];
      builder
        .addSliderInput({
          path: 'lineWidth',
          name: t('status-history.name-line-width', 'Line width'),
          category,
          defaultValue: defaultFieldConfig.lineWidth,
          settings: {
            min: 0,
            max: 10,
            step: 1,
          },
        })
        .addSliderInput({
          path: 'fillOpacity',
          name: t('status-history.name-fill-opacity', 'Fill opacity'),
          category,
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
    const category = [t('status-history.category-status-history', 'Status history')];
    builder
      .addRadio({
        path: 'showValue',
        name: t('status-history.name-show-values', 'Show values'),
        category,
        settings: {
          options: [
            { value: VisibilityMode.Auto, label: t('status-history.show-values-options.label-auto', 'Auto') },
            { value: VisibilityMode.Always, label: t('status-history.show-values-options.label-always', 'Always') },
            { value: VisibilityMode.Never, label: t('status-history.show-values-options.label-never', 'Never') },
          ],
        },
        defaultValue: VisibilityMode.Auto,
      })
      .addSliderInput({
        path: 'rowHeight',
        name: t('status-history.name-row-height', 'Row height'),
        category,
        defaultValue: 0.9,
        settings: {
          min: 0,
          max: 1,
          step: 0.01,
        },
      })
      .addSliderInput({
        path: 'colWidth',
        name: t('status-history.name-column-width', 'Column width'),
        category,
        defaultValue: 0.9,
        settings: {
          min: 0,
          max: 1,
          step: 0.01,
        },
      })
      .addNumberInput({
        path: 'perPage',
        name: t('status-history.name-page-size', 'Page size (enable pagination)'),
        category,
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
