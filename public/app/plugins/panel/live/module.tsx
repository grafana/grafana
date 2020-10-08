import { PanelPlugin } from '@grafana/data';
import { LivePanel } from './LivePanel';
import { LivePanelOptions } from './types';

export const plugin = new PanelPlugin<LivePanelOptions>(LivePanel).setPanelOptions(builder => {
  builder.addTextInput({
    path: 'feedUrl',
    name: 'URL',
    description: 'Only RSS feed formats are supported (not Atom).',
    settings: {
      // placeholder: DEFAULT_FEED_URL,
    },
  });
});
