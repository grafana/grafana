import { PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';

import { defaultCodeOptions, defaultOptions, type Options } from '../panelcfg.gen';

import { TextNGPanel } from './TextNGPanel';
import { textPanelMigrationHandler } from './textPanelMigrationHandler';

export const plugin = new PanelPlugin<Options>(TextNGPanel)
  .setPanelOptions((builder) => {
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
  })
  .setMigrationHandler(textPanelMigrationHandler)
  .setSuggestionsSupplier(() => []);
