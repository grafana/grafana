import { PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';
import { BarGaugeSizing, VizOrientation } from '@grafana/schema';
import { commonOptionsBuilder } from '@grafana/ui';

import { addOrientationOption, addStandardDataReduceOptions } from '../stat/common';

import { EffectsEditor } from './EffectsEditor';
import { GaugePanel } from './GaugePanel';
import { gaugePanelChangedHandler, gaugePanelMigrationHandler, shouldMigrateGauge } from './migrations';
import { defaultGaugePanelEffects, defaultOptions, Options } from './panelcfg.gen';
import { gaugeSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin<Options>(GaugePanel)
  .useFieldConfig({})
  .setPanelOptions((builder) => {
    const category = [t('gauge.category-gauge', 'Gauge')];

    addStandardDataReduceOptions(builder);

    commonOptionsBuilder.addTextSizeOptions(builder, { withTitle: true, withValue: true });

    builder.addRadio({
      path: 'shape',
      name: t('gauge.config.shape', 'Style'),
      category,
      defaultValue: defaultOptions.shape,
      settings: {
        options: [
          { value: 'circle', label: t('gauge.config.shape-circle', 'Circle'), icon: 'circle' },
          { value: 'gauge', label: t('gauge.config.shape-gauge', 'Arc'), icon: 'tachometer-empty' },
        ],
      },
    });

    addOrientationOption(builder, category);

    builder
      .addRadio({
        path: 'sizing',
        name: t('gauge.name-gauge-size', 'Gauge size'),
        settings: {
          options: [
            { value: BarGaugeSizing.Auto, label: t('gauge.gauge-size-options.label-auto', 'Auto') },
            { value: BarGaugeSizing.Manual, label: t('gauge.gauge-size-options.label-manual', 'Manual') },
          ],
        },
        category,
        defaultValue: defaultOptions.sizing,
        showIf: (options: Options) => options.orientation !== VizOrientation.Auto,
      })
      .addSliderInput({
        path: 'minVizWidth',
        name: t('gauge.name-min-width', 'Min width'),
        description: t('gauge.description-min-width', 'Minimum column width (vertical orientation)'),
        defaultValue: defaultOptions.minVizWidth,
        settings: {
          min: 0,
          max: 600,
          step: 1,
        },
        category,
        showIf: (options: Options) =>
          options.sizing === BarGaugeSizing.Manual && options.orientation === VizOrientation.Vertical,
      })
      .addSliderInput({
        path: 'minVizHeight',
        name: t('gauge.name-min-height', 'Min height'),
        description: t('gauge.description-min-height', 'Minimum row height (horizontal orientation)'),
        defaultValue: defaultOptions.minVizHeight,
        category,
        settings: {
          min: 0,
          max: 600,
          step: 1,
        },
        showIf: (options: Options) =>
          options.sizing === BarGaugeSizing.Manual && options.orientation === VizOrientation.Horizontal,
      });

    builder.addSliderInput({
      path: 'barWidthFactor',
      name: t('gauge.config.bar-width', 'Bar width'),
      category,
      defaultValue: defaultOptions.barWidthFactor,
      settings: {
        min: 0.1,
        max: 1,
        step: 0.01,
      },
    });

    builder.addSliderInput({
      path: 'segmentCount',
      name: t('gauge.config.segment-count', 'Segments'),
      category,
      defaultValue: defaultOptions.segmentCount,
      settings: {
        min: 1,
        max: 100,
        step: 1,
      },
    });

    builder.addSliderInput({
      path: 'segmentSpacing',
      name: t('gauge.config.segment-spacing', 'Segment spacing'),
      category,
      defaultValue: defaultOptions.segmentSpacing,
      showIf: (options) => options.segmentCount > 1,
      settings: {
        min: 0,
        max: 1,
        step: 0.01,
      },
    });

    builder.addRadio({
      path: 'barShape',
      name: t('gauge.config.bar-shape', 'Bar Style'),
      category,
      defaultValue: defaultOptions.barShape,
      settings: {
        options: [
          { value: 'flat', label: t('gauge.config.bar-shape-flat', 'Flat') },
          { value: 'rounded', label: t('gauge.config.bar-shape-rounded', 'Rounded') },
        ],
      },
      showIf: (options) => options.segmentCount === 1,
    });

    builder.addRadio({
      path: 'endpointMarker',
      name: t('gauge.config.endpoint-marker', 'Endpoint marker'),
      description: t('gauge.config.endpoint-marker-description', 'Glow is only supported in dark mode'),
      category,
      defaultValue: defaultOptions.endpointMarker,
      settings: {
        options: [
          { value: 'point', label: t('gauge.config.endpoint-marker-point', 'Point') },
          { value: 'glow', label: t('gauge.config.endpoint-marker-glow', 'Glow') },
          { value: 'none', label: t('gauge.config.endpoint-marker-none', 'None') },
        ],
      },
      showIf: (options) => options.barShape === 'rounded' && options.segmentCount === 1,
    });

    builder.addSelect({
      path: 'textMode',
      name: t('gauge.config.text-mode', 'Text mode'),
      category,
      settings: {
        options: [
          { value: 'auto', label: t('gauge.config.text-mode-auto', 'Auto') },
          { value: 'value_and_name', label: t('gauge.config.text-mode-value-and-name', 'Value and Name') },
          { value: 'value', label: t('gauge.config.text-mode-value', 'Value') },
          { value: 'name', label: t('gauge.config.text-mode-name', 'Name') },
          { value: 'none', label: t('gauge.config.text-mode-none', 'None') },
        ],
      },
      defaultValue: defaultOptions.textMode,
    });

    builder.addNumberInput({
      path: 'neutral',
      name: t('gauge.config.neutral.title', 'Neutral value'),
      description: t('gauge.config.neutral.description', 'Leave empty to use Min as neutral point'),
      category,
      settings: {
        placeholder: t('gauge.config.neutral.placeholder', 'none'),
        step: 1,
      },
    });

    builder.addBooleanSwitch({
      path: 'sparkline',
      name: t('gauge.config.sparkline', 'Show sparkline'),
      category,
      defaultValue: defaultOptions.sparkline,
    });

    builder.addBooleanSwitch({
      path: 'showThresholdMarkers',
      name: t('gauge.config.threshold-markers', 'Show thresholds'),
      category,
      defaultValue: defaultOptions.showThresholdMarkers,
    });

    builder.addBooleanSwitch({
      path: 'showThresholdLabels',
      name: t('gauge.config.threshold-labels', 'Show labels'),
      description: t('gauge.config.threshold-labels-description', 'Display threshold and neutral values'),
      category,
      defaultValue: defaultOptions.showThresholdLabels,
    });

    builder.addCustomEditor({
      id: 'gauge-effects',
      path: 'effects',
      name: t('gauge.config.effects.label', 'Effects'),
      category,
      editor: EffectsEditor,
      settings: {},
      defaultValue: defaultGaugePanelEffects,
    });
  })
  .setSuggestionsSupplier(gaugeSuggestionsSupplier)
  .setMigrationHandler(gaugePanelMigrationHandler, shouldMigrateGauge)
  .setPanelChangeHandler(gaugePanelChangedHandler);
