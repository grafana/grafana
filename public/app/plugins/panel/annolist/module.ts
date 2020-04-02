import { AnnoListPanel } from './AnnoListPanel';
import { AnnoOptions, defaults } from './types';
import { AnnoListEditor } from './AnnoListEditor';
import { PanelPlugin } from '@grafana/data';

export const plugin = new PanelPlugin<AnnoOptions>(AnnoListPanel)
  .setDefaults(defaults)
  .setEditor(AnnoListEditor)

  // TODO, we should support this directly in the plugin infrastructure
  .setPanelChangeHandler((options: AnnoOptions, prevPluginId: string, prevOptions: any) => {
    if (prevPluginId === 'ryantxu-annolist-panel') {
      return prevOptions as AnnoOptions;
    }
    return options;
  });
