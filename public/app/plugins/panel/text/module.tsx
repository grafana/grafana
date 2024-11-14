import { PanelPlugin } from '@grafana/data';

import { TextPanel } from './TextPanel';
import { TextPanelEditor } from './TextPanelEditor';
import { CodeLanguage, defaultCodeOptions, defaultOptions, Options, TextMode } from './panelcfg.gen';
import { textPanelMigrationHandler } from './textPanelMigrationHandler';

export const plugin = new PanelPlugin<Options>(TextPanel)
  .setPanelOptions((builder) => {
    builder
      .addRadio({
        path: 'mode',
        name: 'Mode',
        settings: {
          options: [
            { value: TextMode.Markdown, label: 'Markdown' },
            { value: TextMode.HTML, label: 'HTML' },
            { value: TextMode.Code, label: 'Code' },
          ],
        },
        defaultValue: defaultOptions.mode,
      })
      .addSelect({
        path: 'code.language',
        name: 'Language',
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
        name: 'Show line numbers',
        defaultValue: defaultCodeOptions.showLineNumbers,
        showIf: (v) => v.mode === TextMode.Code,
      })
      .addBooleanSwitch({
        path: 'code.showMiniMap',
        name: 'Show mini map',
        defaultValue: defaultCodeOptions.showMiniMap,
        showIf: (v) => v.mode === TextMode.Code,
      })
      .addCustomEditor({
        id: 'content',
        path: 'content',
        name: 'Content',
        editor: TextPanelEditor,
        defaultValue: defaultOptions.content,
      });
  })
  .setMigrationHandler(textPanelMigrationHandler);
