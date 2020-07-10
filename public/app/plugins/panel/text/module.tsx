import { PanelPlugin } from '@grafana/data';

import { TextPanel } from './TextPanel';
import { TextOptions } from './types';
import { textPanelMigrationHandler } from './textPanelMigrationHandler';
import { TextPanelEditor } from './TextPanelEditor';

export const plugin = new PanelPlugin<TextOptions>(TextPanel)
  .setPanelOptions(builder => {
    builder
      .addRadio({
        path: 'mode',
        name: 'Mode',
        description: 'text mode of the panel',
        settings: {
          options: [
            { value: 'markdown', label: 'Markdown' },
            { value: 'html', label: 'HTML' },
          ],
        },
        defaultValue: 'markdown',
      })
      .addCustomEditor({
        id: 'content',
        path: 'content',
        name: 'Content',
        description: 'Content of the panel',
        defaultValue: `# Title

For markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)
         `,
        editor: TextPanelEditor,
      });
  })
  .setMigrationHandler(textPanelMigrationHandler);
