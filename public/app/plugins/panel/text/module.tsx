import { PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';

import { TextPanel } from './TextPanel';
import { TextPanelEditor } from './TextPanelEditor';
import { CodeLanguage, defaultCodeOptions, defaultOptions, Options, TextMode } from './panelcfg.gen';
import { textPanelMigrationHandler } from './textPanelMigrationHandler';

export const plugin = new PanelPlugin<Options>(TextPanel)
  .setPanelOptions((builder) => {
    const category = [t('text.category-text', 'Text')];
    builder
      .addRadio({
        path: 'mode',
        name: t('text.name-mode', 'Mode'),
        category,
        settings: {
          options: [
            { value: TextMode.Markdown, label: t('text.mode-options.label-markdown', 'Markdown') },
            { value: TextMode.HTML, label: t('text.mode-options.label-html', 'HTML') },
            { value: TextMode.Code, label: t('text.mode-options.label-code', 'Code') },
          ],
        },
        defaultValue: defaultOptions.mode,
      })
      .addSelect({
        path: 'code.language',
        name: t('text.name-language', 'Language'),
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
        name: t('text.name-show-line-numbers', 'Show line numbers'),
        category,
        defaultValue: defaultCodeOptions.showLineNumbers,
        showIf: (v) => v.mode === TextMode.Code,
      })
      .addBooleanSwitch({
        path: 'code.showMiniMap',
        name: t('text.name-show-mini-map', 'Show mini map'),
        category,
        defaultValue: defaultCodeOptions.showMiniMap,
        showIf: (v) => v.mode === TextMode.Code,
      })
      .addCustomEditor({
        id: 'content',
        path: 'content',
        name: t('text.name-content', 'Content'),
        category,
        editor: TextPanelEditor,
        defaultValue: defaultOptions.content,
      });
  })
  .setMigrationHandler(textPanelMigrationHandler);
