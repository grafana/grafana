import { initPluginTranslations, t } from '@grafana/i18n';

import { PanelPlugin } from '@grafana/data';
import { SimpleOptions } from './types';
import { SimplePanel } from './components/SimplePanel';
import pluginJson from './plugin.json';

await initPluginTranslations(pluginJson.id);

export const plugin = new PanelPlugin<SimpleOptions>(SimplePanel).setPanelOptions((builder) => {
  return builder
    .addTextInput({
      path: 'text',
      name: t('panel.options.text.name', 'Simple text option'),
      description: t('panel.options.text.description', 'Description of panel option'),
      defaultValue: t('panel.options.text.defaultValue', 'Default value of text input option'),
    })
    .addBooleanSwitch({
      path: 'showSeriesCount',
      name: t('panel.options.showSeriesCount.name', 'Show series counter'),
      defaultValue: false,
    })
    .addRadio({
      path: 'seriesCountSize',
      defaultValue: 'sm',

      name: t('panel.options.seriesCountSize.name', 'Series counter size'),
      settings: {
        options: [
          {
            value: 'sm',
            label: t('panel.options.seriesCountSize.options.sm', 'Small'),
          },
          {
            value: 'md',
            label: t('panel.options.seriesCountSize.options.md', 'Medium'),
          },
          {
            value: 'lg',
            label: t('panel.options.seriesCountSize.options.lg', 'Large'),
          },
        ],
      },
      showIf: (config) => config.showSeriesCount,
    });
});
