import { PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';
import { commonOptionsBuilder } from '@grafana/ui';

import { addOrientationOption, addStandardDataReduceOptions } from '../stat/common';

import { EffectsEditor } from './EffectsEditor';
import { RadialBarPanel } from './RadialBarPanel';
import { gaugePanelChangedHandler, gaugePanelMigrationHandler, shouldMigrateGauge } from './migrations';
import { defaultGaugePanelEffects, defaultOptions, Options } from './panelcfg.gen';
import { radialBarSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin<Options>(RadialBarPanel)
  .useFieldConfig({})
  .setPanelOptions((builder) => {
    const category = [t('gauge.category-radial-bar', 'Gauge')];

    addStandardDataReduceOptions(builder);
    addOrientationOption(builder, category);
    commonOptionsBuilder.addTextSizeOptions(builder, { withTitle: true, withValue: true });

    builder.addRadio({
      path: 'shape',
      name: t('radialbar.config.shape', 'Style'),
      category,
      defaultValue: defaultOptions.shape,
      settings: {
        options: [
          { value: 'circle', label: t('radialbar.config.shape-circle', 'Circle'), icon: 'circle' },
          { value: 'gauge', label: t('radialbar.config.shape-gauge', 'Arc'), icon: 'tachometer-empty' },
        ],
      },
    });

    builder.addSliderInput({
      path: 'barWidthFactor',
      name: t('radialbar.config.bar-width', 'Bar width'),
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
      name: t('radialbar.config.segment-count', 'Segments'),
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
      name: t('radialbar.config.segment-spacing', 'Segment spacing'),
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
      name: t('radialbar.config.bar-shape', 'Bar Style'),
      category,
      defaultValue: defaultOptions.barShape,
      settings: {
        options: [
          { value: 'flat', label: t('radialbar.config.bar-shape-flat', 'Flat') },
          { value: 'rounded', label: t('radialbar.config.bar-shape-rounded', 'Rounded') },
        ],
      },
      showIf: (options) => options.segmentCount === 1,
    });

    builder.addRadio({
      path: 'endpointMarker',
      name: t('radialbar.config.endpoint-marker', 'Endpoint marker'),
      description: t('radialbar.config.endpoint-marker-description', 'Glow is only supported in dark mode'),
      category,
      defaultValue: defaultOptions.endpointMarker,
      settings: {
        options: [
          { value: 'point', label: t('radialbar.config.endpoint-marker-point', 'Point') },
          { value: 'glow', label: t('radialbar.config.endpoint-marker-glow', 'Glow') },
          { value: 'none', label: t('radialbar.config.endpoint-marker-none', 'None') },
        ],
      },
      showIf: (options) => options.barShape === 'rounded' && options.segmentCount === 1,
    });

    builder.addSelect({
      path: 'textMode',
      name: t('radialbar.config.text-mode', 'Text mode'),
      category,
      settings: {
        options: [
          { value: 'auto', label: t('radialbar.config.text-mode-auto', 'Auto') },
          { value: 'value_and_name', label: t('radialbar.config.text-mode-value-and-name', 'Value and Name') },
          { value: 'value', label: t('radialbar.config.text-mode-value', 'Value') },
          { value: 'name', label: t('radialbar.config.text-mode-name', 'Name') },
          { value: 'none', label: t('radialbar.config.text-mode-none', 'None') },
        ],
      },
      defaultValue: defaultOptions.textMode,
    });

    builder.addBooleanSwitch({
      path: 'sparkline',
      name: t('radialbar.config.sparkline', 'Show sparkline'),
      category,
      defaultValue: defaultOptions.sparkline,
    });

    builder.addBooleanSwitch({
      path: 'showThresholdMarkers',
      name: t('radialbar.config.threshold-markers', 'Show thresholds'),
      category,
      defaultValue: defaultOptions.showThresholdMarkers,
    });

    builder.addBooleanSwitch({
      path: 'showThresholdLabels',
      name: t('radialbar.config.threshold-labels', 'Show threshold labels'),
      category,
      defaultValue: defaultOptions.showThresholdLabels,
    });

    builder.addCustomEditor({
      id: 'radialbar-effects',
      path: 'effects',
      name: t('radialbar.config.effects.label', 'Effects'),
      category,
      editor: EffectsEditor,
      settings: {},
      defaultValue: defaultGaugePanelEffects,
    });
  })
  .setSuggestionsSupplier(radialBarSuggestionsSupplier)
  .setMigrationHandler(gaugePanelMigrationHandler, shouldMigrateGauge)
  .setPanelChangeHandler(gaugePanelChangedHandler);
