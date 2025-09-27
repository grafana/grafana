import { PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';
import { commonOptionsBuilder } from '@grafana/ui';

import { addOrientationOption, addStandardDataReduceOptions } from '../stat/common';

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

    builder.addSliderInput({
      path: 'barWidth',
      name: t('radialbar.config.bar-width', 'Bar width'),
      category,
      defaultValue: defaultOptions.barWidth,
      settings: {
        min: 2,
        max: 40,
      },
    });

    builder.addBooleanSwitch({
      path: 'spotlight',
      name: t('radialbar.config.spotlight', 'Spotlight'),
      category,
      defaultValue: defaultOptions.spotlight,
    });

    builder.addRadio({
      path: 'glow',
      name: t('radialbar.config.glow', 'Glow'),
      category,
      defaultValue: defaultOptions.glow,
      settings: {
        options: [
          { value: 'none', label: t('radialbar.config.glow-none', 'None') },
          { value: 'bar', label: t('radialbar.config.glow-bar', 'Bar') },
          { value: 'center', label: t('radialbar.config.glow-center', 'Center') },
          { value: 'both', label: t('radialbar.config.glow-both', 'Both') },
        ],
      },
    });
  })
  .setSuggestionsSupplier(new GaugeSuggestionsSupplier());
