import { PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';
import { commonOptionsBuilder } from '@grafana/ui';

import { addOrientationOption, addStandardDataReduceOptions } from '../stat/common';

import { EffectsEditor } from './EffectsEditor';
import { RadialBarPanel } from './RadialBarPanel';
import { defaultGaugePanelEffects, defaultOptions, Options } from './panelcfg.gen';
import { GaugeSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin<Options>(RadialBarPanel)
  .useFieldConfig({})
  .setPanelOptions((builder) => {
    const category = [t('gauge.category-radial-bar', 'Gauge')];
    addStandardDataReduceOptions(builder);
    addOrientationOption(builder, category);
    commonOptionsBuilder.addTextSizeOptions(builder, { withTitle: true, withValue: true });

    builder.addRadio({
      path: 'shape',
      name: t('radialbar.config.shape', 'Shape'),
      category,
      defaultValue: defaultOptions.shape,
      settings: {
        options: [
          { value: 'circle', label: t('radialbar.config.shape-circle', 'Circle'), icon: 'circle' },
          { value: 'gauge', label: t('radialbar.config.shape-gauge', 'Gauge'), icon: 'tachometer-fast' },
        ],
      },
    });

    builder.addRadio({
      path: 'gradient',
      name: t('radialbar.config.gradient', 'Gradient'),
      category,
      defaultValue: 'none',
      settings: {
        options: [
          { value: 'none', label: t('radialbar.config.gradient-none', 'None') },
          { value: 'auto', label: t('radialbar.config.gradient-auto', 'Auto') },
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

    builder.addCustomEditor({
      id: 'radialbar-effects',
      path: 'effects',
      name: 'Effects',
      category,
      editor: EffectsEditor,
      settings: {},
      defaultValue: defaultGaugePanelEffects,
    });
  })
  .setSuggestionsSupplier(new GaugeSuggestionsSupplier());
