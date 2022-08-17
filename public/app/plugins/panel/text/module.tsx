import { PanelPlugin } from '@grafana/data';

import { TextPanel } from './TextPanel';
import { TextPanelEditor } from './TextPanelEditor';
import { CodeLanguage, defaultCodeOptions, defaultPanelOptions, PanelOptions, TextMode } from './models.gen';
import { textPanelMigrationHandler } from './textPanelMigrationHandler';

export const plugin = new PanelPlugin<PanelOptions>(TextPanel)
  .setPanelOptions((builder) => {
    builder
      .addRadio({
        path: 'mode',
        name: 'Mode',
        description: 'text mode of the panel',
        settings: {
          options: [
            { value: TextMode.Markdown, label: 'Markdown' },
            { value: TextMode.HTML, label: 'HTML' },
            { value: TextMode.Code, label: 'Code' },
          ],
        },
        defaultValue: defaultPanelOptions.mode,
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
        description: 'Content of the panel',
        editor: TextPanelEditor,
        defaultValue: defaultPanelOptions.content,
      });
  })
  .setMigrationHandler(textPanelMigrationHandler);
