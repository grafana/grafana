import { PanelPlugin } from '@grafana/data';

import { LiveChannelEditor } from './LiveChannelEditor';
import { LivePanel } from './LivePanel';
import { LivePanelOptions, MessageDisplayMode, MessagePublishMode } from './types';

export const plugin = new PanelPlugin<LivePanelOptions>(LivePanel).setPanelOptions((builder) => {
  builder.addCustomEditor({
    category: ['Channel'],
    id: 'channel',
    path: 'channel',
    name: 'Channel',
    editor: LiveChannelEditor,
    defaultValue: {},
  });

  builder
    .addRadio({
      path: 'display',
      name: 'Show Message',
      description: 'Display the last message received on this channel',
      settings: {
        options: [
          { value: MessageDisplayMode.Raw, label: 'Raw Text' },
          { value: MessageDisplayMode.JSON, label: 'JSON' },
          { value: MessageDisplayMode.Auto, label: 'Auto' },
          { value: MessageDisplayMode.None, label: 'None' },
        ],
      },
      defaultValue: MessageDisplayMode.JSON,
    })
    .addRadio({
      path: 'publish',
      name: 'Publish',
      description: 'Display a form to publish values',
      settings: {
        options: [
          { value: MessagePublishMode.None, label: 'None' },
          { value: MessagePublishMode.JSON, label: 'JSON' },
          { value: MessagePublishMode.Influx, label: 'Influx' },
        ],
      },
      defaultValue: MessagePublishMode.None,
    });
});
