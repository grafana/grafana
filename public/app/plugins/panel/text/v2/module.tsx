import { PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';

import { defaultCodeOptions, defaultOptions, type Options, TextMode } from '../panelcfg.gen';

import { TextNGPanel } from './TextNGPanel';
import { textPanelMigrationHandler } from './textPanelMigrationHandler';

export const plugin = new PanelPlugin<Options>(TextNGPanel)
  .setPanelOptions((builder) => {
    const category = [t('textng.category-text', 'Text')];
    builder
      // Mode and code language are edited in the panel toolbar; they stay
      // registered here only so their defaults are applied.
      .addCustomEditor({
        id: 'mode',
        path: 'mode',
        name: '',
        category,
        editor: () => null,
        defaultValue: defaultOptions.mode,
        showIf: () => false,
      })
      .addCustomEditor({
        id: 'code.language',
        path: 'code.language',
        name: '',
        category,
        editor: () => null,
        defaultValue: defaultCodeOptions.language,
        showIf: () => false,
      })
      .addBooleanSwitch({
        path: 'code.showLineNumbers',
        name: t('textng.name-show-line-numbers', 'Show line numbers'),
        category,
        defaultValue: defaultCodeOptions.showLineNumbers,
        showIf: (v) => v.mode === TextMode.Code,
      })
      .addCustomEditor({
        id: 'content',
        path: 'content',
        name: '',
        category,
        editor: () => null,
        defaultValue: defaultOptions.content,
        showIf: () => false,
      });
  })
  .setMigrationHandler(textPanelMigrationHandler)
  .setSuggestionsSupplier(() => []);
