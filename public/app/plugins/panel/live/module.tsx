import { PanelPlugin } from '@grafana/data';
import { LiveChannelEditor } from './LiveChannelEditor';
import { LivePanel } from './LivePanel';
import { LivePanelOptions } from './types';

export const plugin = new PanelPlugin<LivePanelOptions>(LivePanel).setPanelOptions(builder => {
  builder.addCustomEditor({
    id: 'channel',
    path: 'channel',
    name: 'Channel',
    editor: LiveChannelEditor,
    defaultValue: {},
  });
});
