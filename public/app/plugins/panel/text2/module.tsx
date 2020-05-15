import { PanelModel, PanelPlugin } from '@grafana/data';

import { TextPanel } from './TextPanel';
import { TextOptions } from './types';

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
            { value: 'text', label: 'Text' },
            { value: 'html', label: 'HTML' },
          ],
        },
        defaultValue: 'markdown',
      })
      .addTextInput({
        path: 'content',
        name: 'Content',
        description: 'Content of the panel',
        settings: {
          useTextarea: true,
          rows: 5,
        },
        defaultValue: `# Title
        
For markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)
         `,
      });
  })
  .setPanelChangeHandler((panel: PanelModel<TextOptions>, prevPluginId: string, prevOptions: any) => {
    if (prevPluginId === 'text') {
      return prevOptions as TextOptions;
    }
    return panel.options;
  });
