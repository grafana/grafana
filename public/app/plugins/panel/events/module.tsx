import { PanelPlugin } from '@grafana/data';
import { EventsPanel } from './EventsPanel';
import { EventsPanelOptions } from './types';

export const plugin = new PanelPlugin<EventsPanelOptions>(EventsPanel).setPanelOptions((builder) => {
  builder.addTextInput({
    path: 'feedUrl',
    name: 'URL',
    description: 'Only RSS feed formats are supported (not Atom).',
    settings: {
      placeholder: 'aaa',
    },
  });
});
