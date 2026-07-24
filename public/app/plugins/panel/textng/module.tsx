import { PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';

import { TextNGPanel } from './TextNGPanel';
import { CodeLanguage, defaultCodeOptions, defaultOptions, type Options, TextMode } from './panelcfg.gen';

export const plugin = new PanelPlugin<Options>(TextNGPanel).setPanelOptions((builder) => {
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
    .addBooleanSwitch({
      path: 'wordWrap',
      name: t('textng.name-word-wrap', 'Word wrap'),
      category,
      defaultValue: defaultOptions.wordWrap,
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
    });
});
