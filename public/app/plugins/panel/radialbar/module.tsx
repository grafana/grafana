import { PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';
import { commonOptionsBuilder } from '@grafana/ui';

import { addOrientationOption, addStandardDataReduceOptions } from '../stat/common';

import { EffectsEditor } from './EffectsEditor';
import { RadialBarPanel } from './RadialBarPanel';
import { defaultOptions, Options } from './panelcfg.gen';
import { GaugeSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin<Options>(RadialBarPanel)
  .useFieldConfig({})
  .setPanelOptions((builder) => {
    const category = [t('gauge.category-radial-bar', 'Radial bar')];
    addStandardDataReduceOptions(builder);
    addOrientationOption(builder, category);
    commonOptionsBuilder.addTextSizeOptions(builder);

    builder.addRadio({
      path: 'shape',
      name: t('radialbar.config.shape', 'Shape'),
      category,
      defaultValue: 'circle',
      settings: {
        options: [
          { value: 'circle', label: t('radialbar.config.shape-circle', 'Circle') },
          { value: 'gauge', label: t('radialbar.config.shape-gauge', 'Gauge') },
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
          { value: 'hue', label: t('radialbar.config.gradient-hue', 'Hue') },
          { value: 'shade', label: t('radialbar.config.gradient-shade', 'Shade') },
          { value: 'scheme', label: t('radialbar.config.gradient-scheme', 'Scheme') },
        ],
      },
    });

    builder.addBooleanSwitch({
      path: 'sparkline',
      name: t('radialbar.config.sparkline', 'Sparkline'),
      category,
      defaultValue: defaultOptions.sparkline,
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

    builder.addCustomEditor({
      id: 'radialbar-effects',
      path: 'effects',
      name: 'Effects',
      editor: EffectsEditor,
      settings: {},
      defaultValue: defaultOptions.effects,
    });
  })
  .setSuggestionsSupplier(new GaugeSuggestionsSupplier());
