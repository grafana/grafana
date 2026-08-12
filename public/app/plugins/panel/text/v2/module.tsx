import { PanelPlugin, type PanelOptionsSupplier } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getFeatureFlagClient } from '@grafana/runtime/internal';

import { defaultCodeOptions, defaultOptions, type Options, RenderMode } from '../panelcfg.gen';

import { TextNGPanel } from './TextNGPanel';
import { hasRenderableData } from './renderContent';
import { textPanelMigrationHandler } from './textPanelMigrationHandler';

export const textNGPanelOptions: PanelOptionsSupplier<Options> = (builder) => {
  const category = [t('textng.category-text', 'Text')];

  // Everything is edited in the panel itself, so options are registered here
  // only so their defaults are applied.
  const addHiddenOption = <T,>(path: string, defaultValue: T) =>
    builder.addCustomEditor({
      id: path,
      path,
      name: '',
      category,
      editor: () => null,
      defaultValue,
      showIf: () => false,
    });

  addHiddenOption('mode', defaultOptions.mode);
  addHiddenOption('content', defaultOptions.content);
  addHiddenOption('code.language', defaultCodeOptions.language);
  addHiddenOption('code.showLineNumbers', defaultCodeOptions.showLineNumbers);
  addHiddenOption('frameIndex', defaultOptions.frameIndex);

  builder.addRadio({
    path: 'renderMode',
    name: t('textng.options.render-mode', 'Render mode'),
    category: [t('textng.category-data', 'Data')],
    defaultValue: defaultOptions.renderMode,
    settings: {
      options: [
        {
          value: RenderMode.Once,
          label: t('textng.render-mode.once', 'Once'),
        },
        {
          value: RenderMode.PerRow,
          label: t('textng.render-mode.per-row', 'Per row'),
        },
      ],
    },
    showIf: (_options, data) =>
      getFeatureFlagClient().getBooleanValue('text.newFeatures', false) && hasRenderableData(data),
  });
};

export const plugin = new PanelPlugin<Options>(TextNGPanel)
  .setPanelOptions(textNGPanelOptions)
  .setMigrationHandler(textPanelMigrationHandler)
  .setSuggestionsSupplier(() => []);
