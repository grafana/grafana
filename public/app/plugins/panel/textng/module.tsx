import { PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';

import {
  CodeLanguage,
  defaultCodeOptions,
  defaultOptions,
  type Options,
  TextMode,
} from '../../schemas/textng/panelcfg.gen';

import { TextNGPanel } from './TextNGPanel';
import { textPanelMigrationHandler } from './textPanelMigrationHandler';

export const plugin = new PanelPlugin<Options>(TextNGPanel)
  .setPanelOptions((builder) => {
    const category = [t('textng.category-text', 'Text')];
    builder
      .addRadio({
        path: 'mode',
        name: t('textng.name-mode', 'Mode'),
        category,
        settings: {
          options: [
            { value: TextMode.Markdown, label: t('textng.mode-options.label-markdown', 'Markdown') },
            { value: TextMode.HTML, label: t('textng.mode-options.label-html', 'HTML') },
            { value: TextMode.Code, label: t('textng.mode-options.label-code', 'Code') },
          ],
        },
        defaultValue: defaultOptions.mode,
      })
      .addSelect({
        path: 'code.language',
        name: t('textng.name-language', 'Language'),
        category,
        settings: {
          options: Object.values(CodeLanguage).map((v) => ({
            value: v,
            label: v,
          })),
        },
        defaultValue: defaultCodeOptions.language,
        showIf: (v) => v.mode === TextMode.Code,
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
